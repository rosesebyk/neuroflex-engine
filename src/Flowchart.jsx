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
// 🎨 CUSTOM GLASSMORPHISM NODE
// ==========================================
const CustomStepNode = ({ data, selected }) => {
  return (
    <div
      className={`relative group px-4 py-3 rounded-2xl w-[240px] transition-all duration-300 backdrop-blur-md ${
        data.isFirst
          ? 'bg-indigo-950/80 border-indigo-500 shadow-indigo-500/20'
          : data.isLast
          ? 'bg-teal-950/80 border-teal-500 shadow-teal-500/20'
          : 'bg-slate-900/90 border-slate-700/80 shadow-slate-950/40'
      } border shadow-xl hover:scale-105 hover:border-indigo-400 ${
        selected ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-indigo-400 !w-3 !h-3 !-left-1.5" />
      <Handle type="source" position={Position.Right} className="!bg-teal-400 !w-3 !h-3 !-right-1.5" />

      <div className="flex items-center justify-between mb-2">
        <span className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm">
          {data.icon || '⚡'}
        </span>
        <span className="text-[10px] font-extrabold tracking-widest uppercase px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400 border border-slate-700">
          Step {data.step || '01'}
        </span>
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-bold text-slate-100 line-clamp-1 group-hover:text-indigo-300 transition">
          {data.title}
        </h4>
        {data.detail && (
          <p className="text-[11px] text-slate-400 font-normal leading-snug line-clamp-2">
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

    // Multi-Row S-Curve Grid Layout
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
          stroke: i === data.length - 2 ? '#14b8a6' : '#6366f1',
          strokeWidth: 2.5,
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
    <div className="w-full h-full min-h-[380px] rounded-2xl overflow-hidden relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Controls className="!bg-slate-900/90 !border-slate-800 !text-slate-200 !rounded-xl !shadow-2xl" />
        <MiniMap
          nodeColor={(n) => (n.data?.isFirst ? '#6366f1' : n.data?.isLast ? '#14b8a6' : '#334155')}
          maskColor="rgba(11, 15, 25, 0.85)"
          className="!bg-slate-950 !border !border-slate-800 !rounded-2xl"
        />
        <Background color="#334155" gap={20} size={1} />
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