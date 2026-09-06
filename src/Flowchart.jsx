import React, { useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

// ==========================================
// 🎨 CALM PALETTE STEP NODE
// ==========================================
const CustomStepNode = ({ data, selected }) => {
  const isAccent = data.isFirst || data.isLast;

  return (
    <div
      className={`relative group px-4 py-3 rounded-[14px] w-[240px] transition-all duration-[320ms] border shadow-nf bg-[var(--surface)] ${
        isAccent
          ? 'border-[var(--teal)]'
          : 'border-[var(--border)]'
      } hover:border-[var(--teal)] ${
        selected ? 'ring-2 ring-[var(--teal)] ring-offset-2 ring-offset-[var(--bg)]' : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[var(--teal)] !w-2.5 !h-2.5 !-left-1.5 !border-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[var(--gold)] !w-2.5 !h-2.5 !-right-1.5 !border-0"
      />

      <div className="flex items-center justify-between mb-2">
        <span className="w-7 h-7 rounded-lg bg-[var(--teal-soft)] border border-[var(--border)] flex items-center justify-center text-sm text-[var(--teal)]">
          {data.icon || '⚡'}
        </span>
        <span className="text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-[var(--gold-soft)] text-[var(--gold)] font-mono">
          Step {data.step || '01'}
        </span>
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-semibold font-[family-name:var(--font-display)] text-[var(--ink)] line-clamp-1 group-hover:text-[var(--teal)] transition-colors">
          {data.title}
        </h4>
        {data.detail && (
          <p className="text-[11px] text-[var(--muted)] font-normal leading-snug line-clamp-2">
            {data.detail}
          </p>
        )}
      </div>
    </div>
  );
};

// ==========================================
// ⚙️ FLOWCHART CANVAS ENGINE
// ==========================================
function FlowchartContent({ data }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  const nodeTypes = useMemo(() => ({ stepNode: CustomStepNode }), []);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const MAX_PER_ROW = 3;
    const X_GAP = 290;
    const Y_GAP = 140;

    const generatedNodes = data.map((item, idx) => {
      const row = Math.floor(idx / MAX_PER_ROW);
      const col = idx % MAX_PER_ROW;
      const actualCol = row % 2 === 0 ? col : MAX_PER_ROW - 1 - col;

      return {
        id: String(item.id || idx + 1),
        type: 'stepNode',
        data: {
          step: item.step || `0${idx + 1}`,
          title: item.title,
          detail: item.detail,
          icon: item.icon,
          isFirst: idx === 0,
          isLast: idx === data.length - 1,
        },
        position: { x: actualCol * X_GAP, y: row * Y_GAP },
      };
    });

    const generatedEdges = [];
    for (let i = 0; i < data.length - 1; i++) {
      const sourceId = String(data[i].id || i + 1);
      const targetId = String(data[i + 1].id || i + 2);

      generatedEdges.push({
        id: `e-${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        animated: true,
        type: 'smoothstep',
        style: {
          stroke: i === data.length - 2 ? '#E4A036' : '#2B6E6B',
          strokeWidth: 2,
        },
      });
    }

    setNodes(generatedNodes);
    setEdges(generatedEdges);

    setTimeout(() => {
      fitView({ padding: 0.25, duration: 500 });
    }, 100);
  }, [data, setNodes, setEdges, fitView]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="w-full h-full min-h-[380px] rounded-[14px] overflow-hidden relative bg-[var(--surface)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Controls className="!bg-[var(--surface)] !border-[var(--border)] !rounded-nf-sm !shadow-nf" />
        <MiniMap
          nodeColor={(n) => (n.data?.isFirst || n.data?.isLast ? '#2B6E6B' : '#EEF0E7')}
          maskColor="rgba(245, 246, 240, 0.75)"
          className="!bg-[var(--surface-2)] !border !border-[var(--border)] !rounded-[14px]"
        />
        <Background color="#DFE3D6" gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}

export default function Flowchart({ data }) {
  return (
    <ReactFlowProvider>
      <FlowchartContent data={data} />
    </ReactFlowProvider>
  );
}
