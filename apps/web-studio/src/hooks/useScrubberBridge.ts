import { useEffect, useRef } from 'react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { useStudioStore, broadcastUniformChange } from '../store/useStudioStore';

export interface ConstantMapping {
  index: number;
  value: number;
  startCol: number;
  endCol: number;
  lineNumber: number;
  rawText: string;
}

/**
 * Extracts numeric literals from equation and generates a parameterized GLSL expression
 * with uniforms u_c[i] replacing literals for 60-120 FPS parameter scrubbing.
 */
export function parameterizeFormula(formula: string): {
  parameterizedGLSL: string;
  mappings: ConstantMapping[];
  initialValues: number[];
} {
  const numberRegex = /(?<![a-zA-Z_0-9])-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g;
  const mappings: ConstantMapping[] = [];
  const initialValues: number[] = [];

  let match: RegExpExecArray | null;
  let slotIndex = 0;
  let lastIndex = 0;
  let parameterized = '';

  while ((match = numberRegex.exec(formula)) !== null && slotIndex < 64) {
    let raw = match[0];
    let start = match.index;
    const end = start + raw.length;

    // Distinguish between binary subtraction and unary negative literal
    if (raw.startsWith('-')) {
      const before = formula.substring(0, start).trimEnd();
      const lastChar = before.slice(-1);
      // If preceded by identifier, closing paren/bracket, or digit, it's binary subtraction
      if (lastChar && /[a-zA-Z0-9_)\]]/.test(lastChar)) {
        start += 1;
        raw = raw.substring(1);
      }
    }

    const val = parseFloat(raw);

    // Check if this number is not an exponent or part of identifier
    mappings.push({
      index: slotIndex,
      value: val,
      startCol: start + 1,
      endCol: end + 1,
      lineNumber: 1,
      rawText: raw,
    });
    initialValues.push(val);

    parameterized += formula.substring(lastIndex, start) + `u_c[${slotIndex}]`;
    lastIndex = end;
    slotIndex++;
  }
  parameterized += formula.substring(lastIndex);

  return {
    parameterizedGLSL: parameterized,
    mappings,
    initialValues,
  };
}

export function useScrubberBridge(
  editorInstance: MonacoEditor.IStandaloneCodeEditor | null,
  equation: string,
  onEquationCommit: (newEq: string) => void
) {
  const { uniformConstants, setActiveScrubber } = useStudioStore();
  const mappingsRef = useRef<ConstantMapping[]>([]);
  const isDraggingRef = useRef(false);
  const dragTargetRef = useRef<{ mapping: ConstantMapping; startX: number; baseVal: number } | null>(null);
  const decorationsRef = useRef<string[]>([]);

  // Update mappings whenever equation changes
  useEffect(() => {
    const { mappings, initialValues } = parameterizeFormula(equation);
    mappingsRef.current = mappings;

    // Populate initial uniform values
    initialValues.forEach((val, i) => {
      uniformConstants[i] = val;
    });
    broadcastUniformChange(uniformConstants, -1);
  }, [equation, uniformConstants]);

  // Bind Monaco Editor Event Handlers
  useEffect(() => {
    if (!editorInstance) return;

    const editorDom = editorInstance.getDomNode();
    if (!editorDom) return;

    // Alt key listener to toggle highlight and col-resize cursor
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !isDraggingRef.current) {
        editorDom.classList.add('scrubber-ready');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey && !isDraggingRef.current) {
        editorDom.classList.remove('scrubber-ready');
        editorInstance.removeDecorations(decorationsRef.current);
        decorationsRef.current = [];
        setActiveScrubber(null);
      }
    };

    // Monaco MouseMove for hover pill highlight
    const mouseMoveDisposable = editorInstance.onMouseMove((e) => {
      if (isDraggingRef.current) return;

      const altHeld = e.event.altKey;
      if (!altHeld || !e.target.position) {
        if (decorationsRef.current.length > 0) {
          editorInstance.removeDecorations(decorationsRef.current);
          decorationsRef.current = [];
        }
        setActiveScrubber(null);
        return;
      }

      const col = e.target.position.column;
      const targetMapping = mappingsRef.current.find(
        (m) => col >= m.startCol && col <= m.endCol
      );

      if (targetMapping) {
        // Highlight this number in neon cyan pill
        const newDecorations = editorInstance.deltaDecorations(decorationsRef.current, [
          {
            range: {
              startLineNumber: targetMapping.lineNumber,
              startColumn: targetMapping.startCol,
              endLineNumber: targetMapping.lineNumber,
              endColumn: targetMapping.endCol,
            },
            options: {
              inlineClassName: 'scrubber-highlight',
              hoverMessage: { value: `**Alt-Drag Scrubber** [Slot u_c[${targetMapping.index}]]: ${targetMapping.value.toFixed(2)}` },
            },
          },
        ]);
        decorationsRef.current = newDecorations;

        const mouseX = e.event.posx || 0;
        const mouseY = e.event.posy || 0;
        setActiveScrubber({
          index: targetMapping.index,
          value: targetMapping.value,
          x: mouseX,
          y: mouseY,
        });
      } else {
        if (decorationsRef.current.length > 0) {
          editorInstance.removeDecorations(decorationsRef.current);
          decorationsRef.current = [];
        }
        setActiveScrubber(null);
      }
    });

    // Monaco MouseDown to start dragging
    const mouseDownDisposable = editorInstance.onMouseDown((e) => {
      if (!e.event.altKey || !e.target.position) return;

      const col = e.target.position.column;
      const targetMapping = mappingsRef.current.find(
        (m) => col >= m.startCol && col <= m.endCol
      );

      if (targetMapping) {
        e.event.preventDefault();
        isDraggingRef.current = true;
        dragTargetRef.current = {
          mapping: targetMapping,
          startX: e.event.posx,
          baseVal: uniformConstants[targetMapping.index],
        };
        document.body.classList.add('scrubber-dragging');
      }
    });

    // Global window drag listeners for continuous 60-120 FPS updates
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !dragTargetRef.current) return;

      const { mapping, startX, baseVal } = dragTargetRef.current;
      const dx = e.clientX - startX;

      // Sensitivity tuning: Shift -> 0.01, Normal -> 0.1, Ctrl -> 1.0
      let step = 0.05;
      if (e.shiftKey) step = 0.005;
      if (e.ctrlKey || e.metaKey) step = 0.5;

      const newVal = parseFloat((baseVal + dx * step).toFixed(3));
      mapping.value = newVal;

      // Direct write to Float32Array & broadcast directly to WebGL
      uniformConstants[mapping.index] = newVal;
      broadcastUniformChange(uniformConstants, mapping.index);

      setActiveScrubber({
        index: mapping.index,
        value: newVal,
        x: e.clientX,
        y: e.clientY - 30,
      });
    };

    const handleWindowMouseUp = () => {
      if (!isDraggingRef.current || !dragTargetRef.current) return;

      isDraggingRef.current = false;
      document.body.classList.remove('scrubber-dragging');

      // Commit final value back to equation text in Monaco
      const { mapping } = dragTargetRef.current;
      const formattedVal = mapping.value % 1 === 0 ? mapping.value.toFixed(1) : mapping.value.toString();

      // Replace text range
      const model = editorInstance.getModel();
      if (model) {
        model.pushEditOperations(
          [],
          [
            {
              range: {
                startLineNumber: mapping.lineNumber,
                startColumn: mapping.startCol,
                endLineNumber: mapping.lineNumber,
                endColumn: mapping.endCol,
              },
              text: formattedVal,
            },
          ],
          () => null
        );
        onEquationCommit(model.getValue());
      }

      dragTargetRef.current = null;
      setActiveScrubber(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      mouseMoveDisposable.dispose();
      mouseDownDisposable.dispose();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      document.body.classList.remove('scrubber-dragging');
    };
  }, [editorInstance, uniformConstants, setActiveScrubber, onEquationCommit]);

  return {
    mappings: mappingsRef.current,
  };
}
