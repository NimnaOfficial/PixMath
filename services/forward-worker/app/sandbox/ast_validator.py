"""Security-critical AST validator for PixMath math expressions.

This module parses user-supplied math expression strings using Python's
:mod:`ast` module and walks the resulting tree to enforce a strict
whitelist of allowed node types, operators, variable names, and function
calls.  Any violation raises :class:`ASTSecurityError` with a detailed,
human-readable message.

Typical usage::

    from app.sandbox import validate

    validated_ast = validate("sin(x * pi) + cos(y * tau)")

Design decisions
~~~~~~~~~~~~~~~~
* **Whitelist-only** – every node type, operator, name, and callable must
  be explicitly allowed.  Unknown constructs are rejected by default.
* **Depth & size limits** – configurable caps prevent adversarial
  expressions from consuming unbounded memory or time.
* **No ``eval`` / ``exec``** – the validated AST is consumed downstream by
  the GLSL transpiler; it is *never* executed as Python code.
"""
from __future__ import annotations

import ast
from dataclasses import dataclass, field
from typing import Final

# ---------------------------------------------------------------------------
# Constants – whitelists
# ---------------------------------------------------------------------------

#: AST node types that are permitted inside an expression.
SAFE_NODE_TYPES: Final[frozenset[type]] = frozenset(
    {
        ast.Expression,
        ast.BinOp,
        ast.UnaryOp,
        ast.Constant,
        ast.Name,
        ast.Call,
        ast.Compare,
        ast.IfExp,
        ast.BoolOp,
        ast.Load,
        # Operators
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.Pow,
        ast.Mod,
        ast.FloorDiv,
        ast.USub,
        ast.UAdd,
        # Comparisons
        ast.Eq,
        ast.NotEq,
        ast.Lt,
        ast.LtE,
        ast.Gt,
        ast.GtE,
        # Booleans
        ast.And,
        ast.Or,
    }
)

#: Binary and unary operator types that are permitted.
SAFE_OPERATORS: Final[frozenset[type]] = frozenset(
    {
        # Binary
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.Pow,
        ast.Mod,
        ast.FloorDiv,
        # Unary
        ast.USub,
        ast.UAdd,
    }
)

#: Comparison operators that are permitted (for IfExp conditions).
SAFE_CMP_OPS: Final[frozenset[type]] = frozenset(
    {
        ast.Eq,
        ast.NotEq,
        ast.Lt,
        ast.LtE,
        ast.Gt,
        ast.GtE,
    }
)

#: Boolean operators that are permitted.
SAFE_BOOL_OPS: Final[frozenset[type]] = frozenset(
    {
        ast.And,
        ast.Or,
    }
)

#: Variable / constant names that may appear as :class:`ast.Name` nodes.
SAFE_NAMES: Final[frozenset[str]] = frozenset(
    {"x", "y", "t", "pi", "e", "tau"}
)

#: Function names that may appear as callables.
SAFE_FUNCTIONS: Final[frozenset[str]] = frozenset(
    {
        "sin",
        "cos",
        "tan",
        "asin",
        "acos",
        "atan",
        "atan2",
        "exp",
        "log",
        "log2",
        "log10",
        "sqrt",
        "abs",
        "min",
        "max",
        "clamp",
        "floor",
        "ceil",
        "fract",
        "sign",
        "step",
        "smoothstep",
        "mix",
        "mod",
        "noise",
        "length",
    }
)

#: Default maximum AST depth.
DEFAULT_MAX_DEPTH: Final[int] = 32

#: Default maximum node count.
DEFAULT_MAX_NODES: Final[int] = 2000

#: Default maximum raw expression length.
DEFAULT_MAX_EXPR_LENGTH: Final[int] = 4096


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class ASTSecurityError(Exception):
    """Raised when an expression violates the security policy.

    Attributes:
        detail: A human-readable explanation of *why* the expression was
            rejected.
    """

    def __init__(self, detail: str) -> None:
        self.detail: str = detail
        super().__init__(detail)


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class ValidationResult:
    """Structured result of an AST validation pass.

    Attributes:
        is_valid:   ``True`` when no security errors were found.
        node_count: Total number of AST nodes visited.
        depth:      Maximum nesting depth of the AST.
        errors:     List of error messages (empty when ``is_valid`` is True).
        warnings:   List of non-fatal warnings (e.g. near-limit depth).
    """

    is_valid: bool
    node_count: int
    depth: int
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# AST visitor
# ---------------------------------------------------------------------------

class SecurityASTValidator(ast.NodeVisitor):
    """Whitelist-based :class:`ast.NodeVisitor` that enforces security policy.

    Parameters:
        max_depth:  Maximum allowed nesting depth (default 32).
        max_nodes:  Maximum allowed total node count (default 2000).
    """

    def __init__(
        self,
        *,
        max_depth: int = DEFAULT_MAX_DEPTH,
        max_nodes: int = DEFAULT_MAX_NODES,
    ) -> None:
        super().__init__()
        self._max_depth: int = max_depth
        self._max_nodes: int = max_nodes

        # Mutable state – reset on each validation run.
        self._errors: list[str] = []
        self._warnings: list[str] = []
        self._node_count: int = 0
        self._current_depth: int = 0
        self._max_seen_depth: int = 0

    # -- helpers -------------------------------------------------------------

    def _reset(self) -> None:
        """Reset internal counters for a fresh validation run."""
        self._errors = []
        self._warnings = []
        self._node_count = 0
        self._current_depth = 0
        self._max_seen_depth = 0

    def _add_error(self, msg: str) -> None:
        self._errors.append(msg)

    def _add_warning(self, msg: str) -> None:
        self._warnings.append(msg)

    # -- public interface ----------------------------------------------------

    def run(self, tree: ast.AST) -> ValidationResult:
        """Validate *tree* and return a :class:`ValidationResult`.

        This does **not** raise on failure; callers should inspect
        :attr:`ValidationResult.is_valid`.
        """
        self._reset()
        self.visit(tree)

        # Near-limit warnings
        depth_ratio = self._max_seen_depth / self._max_depth if self._max_depth else 0
        if depth_ratio > 0.8 and not self._errors:
            self._add_warning(
                f"Expression depth {self._max_seen_depth} is approaching "
                f"the limit of {self._max_depth}."
            )

        node_ratio = self._node_count / self._max_nodes if self._max_nodes else 0
        if node_ratio > 0.8 and not self._errors:
            self._add_warning(
                f"Node count {self._node_count} is approaching "
                f"the limit of {self._max_nodes}."
            )

        return ValidationResult(
            is_valid=len(self._errors) == 0,
            node_count=self._node_count,
            depth=self._max_seen_depth,
            errors=list(self._errors),
            warnings=list(self._warnings),
        )

    # -- visitor methods -----------------------------------------------------

    def generic_visit(self, node: ast.AST) -> None:  # noqa: D401
        """Default visitor – enforces node-type whitelist and limits."""
        # --- node count limit ---
        self._node_count += 1
        if self._node_count > self._max_nodes:
            self._add_error(
                f"Expression exceeds maximum node count of {self._max_nodes}."
            )
            return  # stop walking

        # --- depth limit ---
        self._current_depth += 1
        if self._current_depth > self._max_seen_depth:
            self._max_seen_depth = self._current_depth
        if self._current_depth > self._max_depth:
            self._add_error(
                f"Expression exceeds maximum depth of {self._max_depth}."
            )
            self._current_depth -= 1
            return

        # --- node-type whitelist ---
        if type(node) not in SAFE_NODE_TYPES:
            self._add_error(
                f"Disallowed AST node type: {type(node).__name__} "
                f"(line {getattr(node, 'lineno', '?')}, "
                f"col {getattr(node, 'col_offset', '?')})."
            )
            self._current_depth -= 1
            return

        # --- operator whitelist (BinOp / UnaryOp) ---
        if isinstance(node, ast.BinOp) and type(node.op) not in SAFE_OPERATORS:
            self._add_error(
                f"Disallowed binary operator: {type(node.op).__name__}."
            )
        if isinstance(node, ast.UnaryOp) and type(node.op) not in SAFE_OPERATORS:
            self._add_error(
                f"Disallowed unary operator: {type(node.op).__name__}."
            )

        # --- comparison operator whitelist ---
        if isinstance(node, ast.Compare):
            for op in node.ops:
                if type(op) not in SAFE_CMP_OPS:
                    self._add_error(
                        f"Disallowed comparison operator: {type(op).__name__}."
                    )

        # --- boolean operator whitelist ---
        if isinstance(node, ast.BoolOp) and type(node.op) not in SAFE_BOOL_OPS:
            self._add_error(
                f"Disallowed boolean operator: {type(node.op).__name__}."
            )

        # --- name whitelist ---
        if isinstance(node, ast.Name):
            if node.id not in SAFE_NAMES and node.id not in SAFE_FUNCTIONS:
                self._add_error(
                    f"Disallowed variable name: '{node.id}'."
                )

        # --- constant type check ---
        if isinstance(node, ast.Constant):
            if not isinstance(node.value, (int, float)):
                self._add_error(
                    f"Disallowed constant type: {type(node.value).__name__} "
                    f"(value={node.value!r})."
                )

        # --- function-call whitelist ---
        if isinstance(node, ast.Call):
            self._validate_call(node)

        # Continue walking children.
        super().generic_visit(node)
        self._current_depth -= 1

    def _validate_call(self, node: ast.Call) -> None:
        """Validate a function call node against the whitelist."""
        # Only simple ``Name`` callables are allowed (no attribute access).
        if not isinstance(node.func, ast.Name):
            self._add_error(
                "Only simple function calls are allowed "
                "(no attribute access or method calls)."
            )
            return

        func_name: str = node.func.id
        if func_name not in SAFE_FUNCTIONS:
            self._add_error(
                f"Disallowed function call: '{func_name}'."
            )
            return

        # No keyword arguments.
        if node.keywords:
            self._add_error(
                f"Keyword arguments are not allowed in '{func_name}()' calls."
            )

        # No *args / **kwargs unpacking.
        if node.starargs if hasattr(node, "starargs") else False:  # type: ignore[attr-defined]
            self._add_error("Star-args unpacking is not allowed.")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def validate(
    expr_string: str,
    *,
    max_depth: int = DEFAULT_MAX_DEPTH,
    max_nodes: int = DEFAULT_MAX_NODES,
    max_length: int = DEFAULT_MAX_EXPR_LENGTH,
) -> ast.Expression:
    """Parse and security-validate a math expression string.

    Parameters:
        expr_string: The raw math expression (e.g. ``"sin(x) + cos(y)"``).
        max_depth:   Maximum allowed AST nesting depth.
        max_nodes:   Maximum allowed total AST node count.
        max_length:  Maximum allowed raw character length.

    Returns:
        The validated :class:`ast.Expression` tree, ready for transpilation.

    Raises:
        ASTSecurityError: If the expression violates security policy (bad
            syntax, disallowed constructs, or limit violations).
    """
    if not isinstance(expr_string, str):
        raise ASTSecurityError(
            f"Expression must be a string, got {type(expr_string).__name__}."
        )

    expr_string = expr_string.strip()
    if not expr_string:
        raise ASTSecurityError("Expression string is empty.")

    # --- Pre-parse guards against parser DoS --------------------------------
    if len(expr_string) > max_length:
        raise ASTSecurityError(
            f"Expression length ({len(expr_string)}) exceeds maximum limit of {max_length} characters."
        )

    import re
    if re.search(r"[-+~]{16,}", expr_string):
        raise ASTSecurityError("Excessive consecutive unary operators detected.")

    # --- Parse ---------------------------------------------------------------
    try:
        tree = ast.parse(expr_string, mode="eval")
    except (SyntaxError, RecursionError, MemoryError) as exc:
        raise ASTSecurityError(f"Cannot safely parse expression: {exc}") from exc

    # --- Validate ------------------------------------------------------------
    validator = SecurityASTValidator(max_depth=max_depth, max_nodes=max_nodes)
    result = validator.run(tree)

    if not result.is_valid:
        errors_str = "; ".join(result.errors)
        raise ASTSecurityError(
            f"Expression rejected ({len(result.errors)} violation(s)): "
            f"{errors_str}"
        )

    return tree
