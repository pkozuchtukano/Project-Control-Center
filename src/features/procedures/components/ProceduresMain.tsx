import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Diamond,
  Edit2,
  Hand,
  Loader2,
  MousePointer2,
  Plus,
  Save,
  Square,
  Trash2,
  Type,
  XCircle,
} from 'lucide-react';

import { parseDateVariable } from '../../../utils/dateParsing';
import type {
  Procedure,
  ProcedureFlowAnchor,
  ProcedureFlowEdge,
  ProcedureFlowEdgeOutcome,
  ProcedureFlowNode,
  ProcedureFlowNodeType,
  Project,
} from '../../../types';

type ToolMode = 'select' | 'pan' | 'action' | 'condition' | 'text' | 'connector';
type ProcedureMode = 'list' | 'editor';
type DragState = {
  nodeId: string;
  offsetX: number;
  offsetY: number;
};
type PanState = {
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
};
type ResizeState = {
  kind: 'node' | 'edgeLabel';
  id: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};
type EdgeLabelDragState = {
  id: string;
  startX: number;
  startY: number;
  startLabelX: number;
  startLabelY: number;
};
type ConnectorDraft = {
  fromNodeId: string;
  fromAnchor: ProcedureFlowAnchor;
  pointerX: number;
  pointerY: number;
};

const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 118;
const MIN_NODE_WIDTH = 180;
const MIN_NODE_HEIGHT = 110;
const DEFAULT_EDGE_LABEL_WIDTH = 132;
const DEFAULT_EDGE_LABEL_HEIGHT = 34;
const MIN_EDGE_LABEL_WIDTH = 92;
const MIN_EDGE_LABEL_HEIGHT = 30;
const CANVAS_WIDTH = 1800;
const CANVAS_HEIGHT = 1000;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.2;
const ZOOM_STEP = 0.0015;
const NODE_ANCHORS: ProcedureFlowAnchor[] = ['top', 'right', 'bottom', 'left'];

const createId = (prefix: string) =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const nodeTypeLabels: Record<ProcedureFlowNodeType, string> = {
  start: 'Start',
  action: 'Krok',
  condition: 'Warunek',
  success: 'Sukces',
  failure: 'Blad',
  end: 'Koniec',
  text: 'Tekst',
};

const outcomeLabels: Record<ProcedureFlowEdgeOutcome, string> = {
  next: 'Dalej',
  success: 'Powodzenie',
  failure: 'Niepowodzenie',
};

const createDefaultProcedure = (projectId: string): Procedure => {
  const now = new Date().toISOString();
  const startId = createId('node');

  return {
    id: createId('procedure'),
    projectId,
    title: 'Nowa procedura',
    description: '',
    parameters: [],
    nodes: [
      {
        id: startId,
        type: 'start',
        title: 'Start procedury',
        description: 'Punkt wejscia flow.',
        position: { x: 120, y: 200 },
      },
    ],
    edges: [],
    createdAt: now,
    updatedAt: now,
  };
};

const getNodeClasses = (type: ProcedureFlowNodeType, isSelected: boolean) => {
  const selected = isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-950' : '';
  if (type === 'condition') return `${selected} border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100`;
  if (type === 'success') return `${selected} border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100`;
  if (type === 'failure') return `${selected} border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100`;
  if (type === 'text') return `${selected} border-gray-300 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100`;
  if (type === 'start' || type === 'end') return `${selected} border-indigo-300 bg-indigo-50 text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-100`;
  return `${selected} border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100`;
};

const getNodeIcon = (type: ProcedureFlowNodeType) => {
  if (type === 'condition') return Diamond;
  if (type === 'success') return CheckCircle2;
  if (type === 'failure') return XCircle;
  if (type === 'text') return Type;
  return Square;
};

const getNodeSize = (node: ProcedureFlowNode) => ({
  width: Math.max(MIN_NODE_WIDTH, node.size?.width || DEFAULT_NODE_WIDTH),
  height: Math.max(MIN_NODE_HEIGHT, node.size?.height || DEFAULT_NODE_HEIGHT),
});

const getEdgeLabelSize = (edge: ProcedureFlowEdge) => ({
  width: Math.max(MIN_EDGE_LABEL_WIDTH, edge.labelSize?.width || DEFAULT_EDGE_LABEL_WIDTH),
  height: Math.max(MIN_EDGE_LABEL_HEIGHT, edge.labelSize?.height || DEFAULT_EDGE_LABEL_HEIGHT),
});

const getNodeCenter = (node: ProcedureFlowNode) => ({
  x: node.position.x + getNodeSize(node).width / 2,
  y: node.position.y + getNodeSize(node).height / 2,
});

const getNodeAnchorPoint = (node: ProcedureFlowNode, anchor: ProcedureFlowAnchor) => {
  const size = getNodeSize(node);
  if (anchor === 'top') return { x: node.position.x + size.width / 2, y: node.position.y };
  if (anchor === 'right') return { x: node.position.x + size.width, y: node.position.y + size.height / 2 };
  if (anchor === 'bottom') return { x: node.position.x + size.width / 2, y: node.position.y + size.height };
  return { x: node.position.x, y: node.position.y + size.height / 2 };
};

const getNearestNodeAnchor = (node: ProcedureFlowNode, point: { x: number; y: number }): ProcedureFlowAnchor => {
  return NODE_ANCHORS.reduce((nearest, anchor) => {
    const nearestPoint = getNodeAnchorPoint(node, nearest);
    const anchorPoint = getNodeAnchorPoint(node, anchor);
    const nearestDistance = Math.hypot(point.x - nearestPoint.x, point.y - nearestPoint.y);
    const anchorDistance = Math.hypot(point.x - anchorPoint.x, point.y - anchorPoint.y);
    return anchorDistance < nearestDistance ? anchor : nearest;
  }, NODE_ANCHORS[0]);
};

const getNodeEdgePoint = (from: ProcedureFlowNode, to: ProcedureFlowNode) => {
  const fromCenter = getNodeCenter(from);
  const toCenter = getNodeCenter(to);
  const fromSize = getNodeSize(from);
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (dx === 0 && dy === 0) return fromCenter;

  const halfWidth = fromSize.width / 2;
  const halfHeight = fromSize.height / 2;
  const scale = Math.min(
    dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx),
    dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy),
  );

  return {
    x: fromCenter.x + dx * scale,
    y: fromCenter.y + dy * scale,
  };
};

const getEdgePoints = (edge: ProcedureFlowEdge, from: ProcedureFlowNode, to: ProcedureFlowNode) => ({
  start: edge.fromAnchor ? getNodeAnchorPoint(from, edge.fromAnchor) : getNodeEdgePoint(from, to),
  end: edge.toAnchor ? getNodeAnchorPoint(to, edge.toAnchor) : getNodeEdgePoint(to, from),
});

const getAnchorVector = (anchor: ProcedureFlowAnchor) => {
  if (anchor === 'top') return { x: 0, y: -1 };
  if (anchor === 'right') return { x: 1, y: 0 };
  if (anchor === 'bottom') return { x: 0, y: 1 };
  return { x: -1, y: 0 };
};

const getDirectionVector = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!length) return { x: 1, y: 0 };
  return { x: dx / length, y: dy / length };
};

const getConnectionPath = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  fromAnchor?: ProcedureFlowAnchor,
  toAnchor?: ProcedureFlowAnchor
) => {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const controlDistance = Math.max(70, Math.min(180, distance * 0.45));
  const startVector = fromAnchor ? getAnchorVector(fromAnchor) : getDirectionVector(start, end);
  const endVector = toAnchor ? getAnchorVector(toAnchor) : getDirectionVector(end, start);
  const c1 = {
    x: start.x + startVector.x * controlDistance,
    y: start.y + startVector.y * controlDistance,
  };
  const c2 = {
    x: end.x + endVector.x * controlDistance,
    y: end.y + endVector.y * controlDistance,
  };

  return `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
};

const getDefaultEdgeLabelPosition = (start: { x: number; y: number }, end: { x: number; y: number }) => ({
  x: start.x + (end.x - start.x) / 2,
  y: start.y + (end.y - start.y) / 2 - 18,
});

const getCanvasPoint = (element: HTMLElement, clientX: number, clientY: number, pan: { x: number; y: number }, zoom: number) => {
  const rect = element.getBoundingClientRect();
  return {
    x: (clientX - rect.left - pan.x) / zoom,
    y: (clientY - rect.top - pan.y) / zoom,
  };
};

const normalizeTemplateVariableKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const formatNullableNumber = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';

const getProcedureVariableDefinitions = (project: Project) => {
  const taskTypeNames = (project.taskTypes || []).map(taskType => taskType.name.trim()).filter(Boolean);
  const stakeholderNames = (project.stakeholders || []).map(stakeholder => stakeholder.name.trim()).filter(Boolean);
  const today = new Date();

  return [
    { token: 'data', aliases: ['dzis', 'today'], value: parseDateVariable('data', today) || '' },
    { token: 'data+3d', aliases: [], value: parseDateVariable('data+3d', today) || '' },
    { token: 'data-1w', aliases: [], value: parseDateVariable('data-1w', today) || '' },
    { token: 'projekt_id', aliases: ['projectId'], value: project.id || '' },
    { token: 'kod_projektu', aliases: ['projectCode', 'code'], value: project.code || '' },
    { token: 'nazwa_projektu', aliases: ['projectName', 'name'], value: project.name || '' },
    { token: 'nr_umowy', aliases: ['contractNo', 'contractNumber'], value: project.contractNo || '' },
    { token: 'przedmiot_umowy', aliases: ['contractSubject'], value: project.contractSubject || '' },
    { token: 'projekt_data_od', aliases: ['projectDateFrom'], value: project.dateFrom || '' },
    { token: 'projekt_data_do', aliases: ['projectDateTo'], value: project.dateTo || '' },
    { token: 'min_godzin', aliases: ['projectMinHours', 'minHours'], value: formatNullableNumber(project.minHours) },
    { token: 'max_godzin', aliases: ['projectMaxHours', 'maxHours'], value: formatNullableNumber(project.maxHours) },
    { token: 'stawka_netto', aliases: ['projectRateNetto', 'rateNetto'], value: formatNullableNumber(project.rateNetto) },
    { token: 'stawka_brutto', aliases: ['projectRateBrutto', 'rateBrutto'], value: formatNullableNumber(project.rateBrutto) },
    { token: 'stawka_vat', aliases: ['projectVatRate', 'vatRate'], value: formatNullableNumber(project.vatRate) },
    { token: 'czy_utrzymanie', aliases: ['hasMaintenance'], value: project.hasMaintenance ? 'TAK' : 'NIE' },
    { token: 'utrzymanie_kwota_netto', aliases: ['maintenanceNetAmount'], value: formatNullableNumber(project.maintenanceNetAmount) },
    { token: 'utrzymanie_stawka_vat', aliases: ['maintenanceVatRate'], value: formatNullableNumber(project.maintenanceVatRate) },
    { token: 'utrzymanie_kwota_brutto', aliases: ['maintenanceGrossAmount'], value: formatNullableNumber(project.maintenanceGrossAmount) },
    { token: 'cel_marzy_proc', aliases: ['targetProfitPct', 'targetProfitPercent'], value: formatNullableNumber(project.targetProfitPct) },
    { token: 'youtrack_query', aliases: ['youtrackQuery'], value: project.youtrackQuery || '' },
    { token: 'google_doc_link', aliases: ['googleDocLink'], value: project.googleDocLink || '' },
    { token: 'typy_zadan', aliases: ['taskTypes', 'taskTypeNames'], value: taskTypeNames.join(', ') },
    { token: 'liczba_typow_zadan', aliases: ['taskTypesCount'], value: String(taskTypeNames.length) },
    { token: 'interesariusze', aliases: ['stakeholders', 'stakeholderNames'], value: stakeholderNames.join(', ') },
    { token: 'liczba_interesariuszy', aliases: ['stakeholdersCount'], value: String((project.stakeholders || []).length) },
  ];
};

const extractProcedureVariableReferences = (procedure: Procedure) => {
  const template = [
    procedure.title,
    procedure.description,
    ...procedure.nodes.flatMap(node => [node.title, node.description]),
    ...procedure.edges.map(edge => edge.labelHidden ? '' : edge.label),
  ].filter(Boolean).join('\n');
  const references: string[] = [];
  const matches = template.matchAll(/{{\s*([^{}]+?)\s*}}/g);

  for (const match of matches) {
    const token = String(match[1] || '').trim();
    if (token) references.push(token);
  }

  return references;
};

type ProceduresMainProps = {
  project: Project;
};

export const ProceduresMain = ({ project }: ProceduresMainProps) => {
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Procedure>(() => createDefaultProcedure(project.id));
  const [mode, setMode] = useState<ProcedureMode>('list');
  const [activeTool, setActiveTool] = useState<ToolMode>('select');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [edgeLabelDragState, setEdgeLabelDragState] = useState<EdgeLabelDragState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [connectorDraft, setConnectorDraft] = useState<ConnectorDraft | null>(null);
  const [canvasPan, setCanvasPan] = useState({ x: 24, y: 24 });
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nodeMap = useMemo(() => new Map(draft.nodes.map(node => [node.id, node])), [draft.nodes]);
  const selectedProcedure = procedures.find(procedure => procedure.id === selectedProcedureId) || null;
  const availableVariables = useMemo(() => getProcedureVariableDefinitions(project), [project]);
  const knownVariableKeys = useMemo(
    () => new Set(
      availableVariables
        .flatMap(variable => [variable.token, ...(variable.aliases || [])])
        .map(item => normalizeTemplateVariableKey(item))
    ),
    [availableVariables]
  );
  const detectedCustomVariableTokens = useMemo(
    () => Array.from(
      new Map(
        extractProcedureVariableReferences(draft)
          .filter(token => !parseDateVariable(token))
          .filter(token => !knownVariableKeys.has(normalizeTemplateVariableKey(token)))
          .map(token => [normalizeTemplateVariableKey(token), token.trim()] as const)
          .filter(([normalized]) => !!normalized)
      ).values()
    ),
    [draft, knownVariableKeys]
  );

  const endPointerInteraction = () => {
    setDragState(null);
    setEdgeLabelDragState(null);
    setPanState(null);
    setResizeState(null);
    setConnectorDraft(null);
  };

  const loadProcedures = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (window.electron?.getProcedures) {
        const saved = await window.electron.getProcedures(project.id);
        setProcedures(saved || []);
        setSelectedProcedureId(null);
        setDraft(createDefaultProcedure(project.id));
        setMode('list');
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        return;
      }

      const local = JSON.parse(localStorage.getItem(`pcc_procedures:${project.id}`) || '[]') as Procedure[];
      setProcedures(local);
      setSelectedProcedureId(null);
      setDraft(createDefaultProcedure(project.id));
      setMode('list');
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    } catch (loadError) {
      console.error('Procedure load failed:', loadError);
      setError('Nie udalo sie pobrac procedur.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProcedures();
  }, [project.id]);

  useEffect(() => {
    setDraft(current => {
      const existingCustom = current.parameters.filter(parameter => parameter.key === 'custom');
      const existingByKey = new Map(existingCustom.map(parameter => [normalizeTemplateVariableKey(parameter.name), parameter]));
      const nextCustomParameters = detectedCustomVariableTokens.map(token => {
        const normalizedToken = normalizeTemplateVariableKey(token);
        return existingByKey.get(normalizedToken) || {
          id: createId('param'),
          key: 'custom' as const,
          name: token,
          required: false,
        };
      });
      const staticParameters = current.parameters.filter(parameter => parameter.key !== 'custom');
      const nextParameters = [...staticParameters, ...nextCustomParameters];

      if (
        nextParameters.length === current.parameters.length &&
        nextParameters.every((parameter, index) => parameter.id === current.parameters[index]?.id && parameter.name === current.parameters[index]?.name)
      ) {
        return current;
      }

      const activeParameterIds = new Set(nextParameters.map(parameter => parameter.id));
      return {
        ...current,
        parameters: nextParameters,
        nodes: current.nodes.map(node => ({
          ...node,
          parameterIds: (node.parameterIds || []).filter(parameterId => activeParameterIds.has(parameterId)),
        })),
      };
    });
  }, [detectedCustomVariableTokens]);

  useEffect(() => {
    window.addEventListener('pointerup', endPointerInteraction);
    window.addEventListener('pointercancel', endPointerInteraction);
    window.addEventListener('blur', endPointerInteraction);

    return () => {
      window.removeEventListener('pointerup', endPointerInteraction);
      window.removeEventListener('pointercancel', endPointerInteraction);
      window.removeEventListener('blur', endPointerInteraction);
    };
  }, []);

  const persistLocal = (nextProcedures: Procedure[]) => {
    localStorage.setItem(`pcc_procedures:${project.id}`, JSON.stringify(nextProcedures));
  };

  const setNodePatch = (nodeId: string, patch: Partial<ProcedureFlowNode>) => {
    setDraft(current => ({
      ...current,
      nodes: current.nodes.map(node => node.id === nodeId ? { ...node, ...patch } : node),
    }));
  };

  const setEdgePatch = (edgeId: string, patch: Partial<ProcedureFlowEdge>) => {
    setDraft(current => ({
      ...current,
      edges: current.edges.map(edge => edge.id === edgeId ? { ...edge, ...patch } : edge),
    }));
  };

  const addNodeAt = (type: ProcedureFlowNodeType, x: number, y: number) => {
    const nodeId = createId('node');
    const isTextNode = type === 'text';
    const node: ProcedureFlowNode = {
      id: nodeId,
      type,
      title: isTextNode ? 'Dowolny tekst' : nodeTypeLabels[type],
      description: isTextNode ? '' : type === 'condition' ? 'Warunek przejscia.' : 'Opisz czynnosc.',
      parameterIds: [],
      position: {
        x: Math.max(20, Math.round(x - (isTextNode ? 180 : DEFAULT_NODE_WIDTH) / 2)),
        y: Math.max(20, Math.round(y - (isTextNode ? 72 : DEFAULT_NODE_HEIGHT) / 2)),
      },
      size: isTextNode ? { width: 180, height: 72 } : undefined,
    };

    setDraft(current => ({
      ...current,
      nodes: [...current.nodes, node],
    }));
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setActiveTool('select');
  };

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rawType = event.dataTransfer.getData('application/pcc-procedure-node');
    if (rawType !== 'action' && rawType !== 'condition' && rawType !== 'text') return;
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    const point = getCanvasPoint(viewport, event.clientX, event.clientY, canvasPan, canvasZoom);
    addNodeAt(rawType, point.x, point.y);
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    const point = getCanvasPoint(viewport, event.clientX, event.clientY, canvasPan, canvasZoom);

    if (panState) {
      setCanvasPan({
        x: panState.startPanX + event.clientX - panState.startClientX,
        y: panState.startPanY + event.clientY - panState.startClientY,
      });
      return;
    }

    if (dragState) {
      setNodePatch(dragState.nodeId, {
        position: {
          x: Math.max(0, Math.round(point.x - dragState.offsetX)),
          y: Math.max(0, Math.round(point.y - dragState.offsetY)),
        },
      });
      return;
    }

    if (edgeLabelDragState) {
      setEdgePatch(edgeLabelDragState.id, {
        labelPosition: {
          x: Math.round(edgeLabelDragState.startLabelX + point.x - edgeLabelDragState.startX),
          y: Math.round(edgeLabelDragState.startLabelY + point.y - edgeLabelDragState.startY),
        },
      });
      return;
    }

    if (resizeState) {
      const width = Math.round(resizeState.startWidth + point.x - resizeState.startX);
      const height = Math.round(resizeState.startHeight + point.y - resizeState.startY);

      if (resizeState.kind === 'node') {
        setNodePatch(resizeState.id, {
          size: {
            width: Math.max(MIN_NODE_WIDTH, width),
            height: Math.max(MIN_NODE_HEIGHT, height),
          },
        });
      } else {
        setEdgePatch(resizeState.id, {
          labelSize: {
            width: Math.max(MIN_EDGE_LABEL_WIDTH, width),
            height: Math.max(MIN_EDGE_LABEL_HEIGHT, height),
          },
        });
      }
      return;
    }

    if (connectorDraft) {
      setConnectorDraft({
        ...connectorDraft,
        pointerX: point.x,
        pointerY: point.y,
      });
    }
  };

  const handleCanvasPointerUp = () => {
    endPointerInteraction();
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);

    if (activeTool !== 'pan') return;

    event.preventDefault();
    setPanState({
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: canvasPan.x,
      startPanY: canvasPan.y,
    });
  };

  const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const viewport = canvasViewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const logicalX = (pointerX - canvasPan.x) / canvasZoom;
    const logicalY = (pointerY - canvasPan.y) / canvasZoom;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, canvasZoom * (1 - event.deltaY * ZOOM_STEP)));

    if (nextZoom === canvasZoom) return;

    setCanvasZoom(nextZoom);
    setCanvasPan({
      x: pointerX - logicalX * nextZoom,
      y: pointerY - logicalY * nextZoom,
    });
  };

  const handleNodePointerDown = (event: React.PointerEvent<HTMLDivElement>, node: ProcedureFlowNode) => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    event.stopPropagation();
    const point = getCanvasPoint(viewport, event.clientX, event.clientY, canvasPan, canvasZoom);

    if (activeTool === 'pan') {
      setPanState({
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPanX: canvasPan.x,
        startPanY: canvasPan.y,
      });
      return;
    }

    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);

    if (activeTool === 'connector') {
      setConnectorDraft({
        fromNodeId: node.id,
        fromAnchor: getNearestNodeAnchor(node, point),
        pointerX: point.x,
        pointerY: point.y,
      });
      return;
    }

    setDragState({
      nodeId: node.id,
      offsetX: point.x - node.position.x,
      offsetY: point.y - node.position.y,
    });
  };

  const startConnectorFromAnchor = (
    event: React.PointerEvent<HTMLButtonElement>,
    node: ProcedureFlowNode,
    anchor: ProcedureFlowAnchor
  ) => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    event.stopPropagation();
    const start = getNodeAnchorPoint(node, anchor);
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setConnectorDraft({
      fromNodeId: node.id,
      fromAnchor: anchor,
      pointerX: start.x,
      pointerY: start.y,
    });
  };

  const handleNodePointerUp = (event: React.PointerEvent<HTMLDivElement>, targetNode: ProcedureFlowNode) => {
    event.stopPropagation();
    if (!connectorDraft || connectorDraft.fromNodeId === targetNode.id) {
      endPointerInteraction();
      return;
    }

    const viewport = canvasViewportRef.current;
    const pointerPoint = viewport
      ? getCanvasPoint(viewport, event.clientX, event.clientY, canvasPan, canvasZoom)
      : getNodeCenter(targetNode);
    const fromNode = nodeMap.get(connectorDraft.fromNodeId);
    const outcome: ProcedureFlowEdgeOutcome =
      fromNode?.type === 'condition'
        ? draft.edges.some(edge => edge.fromNodeId === fromNode.id && edge.outcome === 'success') ? 'failure' : 'success'
        : 'next';

    const edgeId = createId('edge');
    setDraft(current => ({
      ...current,
      edges: [
        ...current.edges,
        {
          id: edgeId,
          fromNodeId: connectorDraft.fromNodeId,
          toNodeId: targetNode.id,
          outcome,
          fromAnchor: connectorDraft.fromAnchor,
          toAnchor: getNearestNodeAnchor(targetNode, pointerPoint),
        },
      ],
    }));
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    endPointerInteraction();
    setActiveTool('select');
  };

  const startNodeResize = (event: React.PointerEvent<HTMLButtonElement>, node: ProcedureFlowNode) => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    event.stopPropagation();
    const point = getCanvasPoint(viewport, event.clientX, event.clientY, canvasPan, canvasZoom);
    const size = getNodeSize(node);
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setDragState(null);
    setEdgeLabelDragState(null);
    setResizeState({
      kind: 'node',
      id: node.id,
      startX: point.x,
      startY: point.y,
      startWidth: size.width,
      startHeight: size.height,
    });
  };

  const startEdgeLabelResize = (event: React.PointerEvent<HTMLButtonElement>, edge: ProcedureFlowEdge) => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    event.stopPropagation();
    const point = getCanvasPoint(viewport, event.clientX, event.clientY, canvasPan, canvasZoom);
    const size = getEdgeLabelSize(edge);
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setDragState(null);
    setEdgeLabelDragState(null);
    setResizeState({
      kind: 'edgeLabel',
      id: edge.id,
      startX: point.x,
      startY: point.y,
      startWidth: size.width,
      startHeight: size.height,
    });
  };

  const startEdgeLabelDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    edge: ProcedureFlowEdge,
    position: { x: number; y: number }
  ) => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    event.stopPropagation();
    const point = getCanvasPoint(viewport, event.clientX, event.clientY, canvasPan, canvasZoom);
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setResizeState(null);
    setEdgeLabelDragState({
      id: edge.id,
      startX: point.x,
      startY: point.y,
      startLabelX: position.x,
      startLabelY: position.y,
    });
  };

  const handleToolbarDragStart = (event: React.DragEvent<HTMLButtonElement>, type: ProcedureFlowNodeType) => {
    event.dataTransfer.setData('application/pcc-procedure-node', type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handleNewProcedure = () => {
    const next = createDefaultProcedure(project.id);
    setSelectedProcedureId(null);
    setDraft(next);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setMode('editor');
  };

  const handleSelectProcedure = (procedure: Procedure) => {
    setSelectedProcedureId(procedure.id);
    setDraft(procedure);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setActiveTool('select');
    setMode('editor');
  };

  const handleDeleteNode = () => {
    if (!selectedNodeId) return;
    const node = nodeMap.get(selectedNodeId);
    if (!node || node.type === 'start') return;

    setDraft(current => ({
      ...current,
      nodes: current.nodes.filter(item => item.id !== selectedNodeId),
      edges: current.edges.filter(edge => edge.fromNodeId !== selectedNodeId && edge.toNodeId !== selectedNodeId),
    }));
    setSelectedNodeId(null);
  };

  const handleDeleteEdge = () => {
    if (!selectedEdgeId) return;
    setDraft(current => ({
      ...current,
      edges: current.edges.filter(edge => edge.id !== selectedEdgeId),
    }));
    setSelectedEdgeId(null);
  };

  const handleSave = async () => {
    const title = draft.title.trim();
    if (!title) {
      setError('Tytul procedury jest wymagany.');
      return;
    }

    const now = new Date().toISOString();
    const procedureToSave: Procedure = {
      ...draft,
      projectId: project.id,
      title,
      updatedAt: now,
      createdAt: draft.createdAt || now,
    };

    setIsSaving(true);
    setError(null);
    try {
      if (window.electron?.saveProcedure) {
        await window.electron.saveProcedure({ projectId: project.id, data: procedureToSave });
        await loadProcedures();
      } else {
        const nextProcedures = [
          procedureToSave,
          ...procedures.filter(procedure => procedure.id !== procedureToSave.id),
        ];
        setProcedures(nextProcedures);
        persistLocal(nextProcedures);
      }
      setSelectedProcedureId(procedureToSave.id);
      setDraft(procedureToSave);
    } catch (saveError) {
      console.error('Procedure save failed:', saveError);
      setError('Nie udalo sie zapisac procedury.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProcedure = async (procedure: Procedure) => {
    if (!window.confirm(`Usunac procedure "${procedure.title}"?`)) return;

    try {
      if (window.electron?.deleteProcedure) {
        await window.electron.deleteProcedure(procedure.id);
        await loadProcedures();
      } else {
        const nextProcedures = procedures.filter(item => item.id !== procedure.id);
        setProcedures(nextProcedures);
        persistLocal(nextProcedures);
        setSelectedProcedureId(null);
        setDraft(createDefaultProcedure(project.id));
      }
      setMode('list');
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    } catch (deleteError) {
      console.error('Procedure delete failed:', deleteError);
      setError('Nie udalo sie usunac procedury.');
    }
  };

  const handleCopyVariable = async (token: string) => {
    await navigator.clipboard.writeText(`{{${token}}}`);
    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken(current => current === token ? null : current), 1600);
  };

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) || null : null;
  const selectedEdge = selectedEdgeId ? draft.edges.find(edge => edge.id === selectedEdgeId) || null : null;
  const selectedElementVariables = useMemo(() => {
    const source = selectedNode
      ? [selectedNode.title, selectedNode.description].filter(Boolean).join('\n')
      : selectedEdge?.label || '';
    const matches = source.matchAll(/{{\s*([^{}]+?)\s*}}/g);
    return Array.from(new Set(Array.from(matches).map(match => String(match[1] || '').trim()).filter(Boolean)));
  }, [selectedEdge, selectedNode]);

  return (
    <div className="h-full overflow-y-auto p-4 xl:p-6">
      <div className="mx-auto flex max-w-[1900px] flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">Procedury</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Procedury projektu {project.code}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'editor' && (
              <button type="button" onClick={() => setMode('list')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-bold text-gray-700 transition hover:bg-white dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900">
                Lista
              </button>
            )}
            <button type="button" onClick={handleNewProcedure} className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-bold text-gray-700 transition hover:bg-white dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900" title="Dodaj nowa procedure">
              <Plus size={16} />
              {mode === 'list' ? 'Dodaj' : 'Nowa'}
            </button>
            {mode === 'editor' && (
              <button type="button" onClick={() => void handleSave()} disabled={isSaving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Zapisz
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        {mode === 'list' && (
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Lista procedur</h2>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-500">
                <Loader2 size={15} className="animate-spin" />
                Ladowanie procedur...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {procedures.map(procedure => (
                  <article key={procedure.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/50">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelectProcedure(procedure)}
                        className="min-w-0 flex-1 rounded-md text-left outline-none transition hover:text-indigo-600 focus:ring-2 focus:ring-indigo-500 dark:hover:text-indigo-300"
                        title="Wyswietl procedure"
                      >
                        <h3 className="break-words text-base font-black text-gray-900 dark:text-white">{procedure.title}</h3>
                        {procedure.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{procedure.description}</p>
                        )}
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => handleSelectProcedure(procedure)} className="rounded-lg p-2 text-gray-500 hover:bg-white hover:text-indigo-600 dark:hover:bg-gray-900" title="Edytuj procedure">
                          <Edit2 size={16} />
                        </button>
                        <button type="button" onClick={() => void handleDeleteProcedure(procedure)} className="rounded-lg p-2 text-gray-500 hover:bg-white hover:text-red-600 dark:hover:bg-gray-900" title="Usun procedure">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {!isLoading && procedures.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-200 px-4 py-16 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                Brak zapisanych procedur w tym projekcie. Kliknij +, aby utworzyc czysty canvas ze startem.
              </div>
            )}
          </section>
        )}

        {mode === 'editor' && (
        <section className="grid min-h-[760px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="grid h-full min-h-[760px] grid-cols-[72px_minmax(0,1fr)]">
              <aside className="flex flex-col items-center gap-2 border-r border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/60">
                <button type="button" onClick={() => setActiveTool('select')} title="Zaznacz i przesuwaj" className={`h-11 w-11 rounded-lg border inline-flex items-center justify-center ${activeTool === 'select' ? 'border-indigo-400 bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}>
                  <MousePointer2 size={19} />
                </button>
                <button type="button" onClick={() => setActiveTool('pan')} title="Przesuwaj widok" className={`h-11 w-11 rounded-lg border inline-flex items-center justify-center ${activeTool === 'pan' ? 'border-slate-400 bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-100' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}>
                  <Hand size={19} />
                </button>
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => handleToolbarDragStart(event, 'action')}
                  onClick={() => addNodeAt('action', 420, 260)}
                  title="Klocek: konkretny krok"
                  className={`h-11 w-11 rounded-lg border inline-flex items-center justify-center ${activeTool === 'action' ? 'border-sky-400 bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
                >
                  <Square size={19} />
                </button>
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => handleToolbarDragStart(event, 'condition')}
                  onClick={() => addNodeAt('condition', 720, 260)}
                  title="Romb: warunek"
                  className={`h-11 w-11 rounded-lg border inline-flex items-center justify-center ${activeTool === 'condition' ? 'border-amber-400 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
                >
                  <Diamond size={20} />
                </button>
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => handleToolbarDragStart(event, 'text')}
                  onClick={() => addNodeAt('text', 570, 180)}
                  title="Dowolny tekst"
                  className={`h-11 w-11 rounded-lg border inline-flex items-center justify-center ${activeTool === 'text' ? 'border-violet-400 bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
                >
                  <Type size={20} />
                </button>
                <button type="button" onClick={() => setActiveTool('connector')} title="Linia ze strzalka: powiazanie" className={`h-11 w-11 rounded-lg border inline-flex items-center justify-center ${activeTool === 'connector' ? 'border-emerald-400 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}>
                  <ArrowRight size={20} />
                </button>
                <div className="my-2 h-px w-full bg-gray-200 dark:bg-gray-800" />
                <button type="button" onClick={selectedNodeId ? handleDeleteNode : handleDeleteEdge} disabled={!selectedNodeId && !selectedEdgeId} title="Usun zaznaczony element" className="h-11 w-11 rounded-lg border border-red-200 bg-white text-red-500 inline-flex items-center justify-center hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-red-900 dark:bg-gray-900 dark:hover:bg-red-950/40">
                  <Trash2 size={18} />
                </button>
              </aside>

              <div
                ref={canvasViewportRef}
                className={`relative overflow-hidden bg-[linear-gradient(#e5e7eb_1px,transparent_1px),linear-gradient(90deg,#e5e7eb_1px,transparent_1px)] bg-[size:28px_28px] dark:bg-[linear-gradient(#1f2937_1px,transparent_1px),linear-gradient(90deg,#1f2937_1px,transparent_1px)] ${activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleCanvasDrop}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerLeave={handleCanvasPointerUp}
                onPointerDown={handleCanvasPointerDown}
                onWheel={handleCanvasWheel}
              >
                <div
                  className="relative"
                  style={{
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                    transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
                    transformOrigin: '0 0',
                  }}
                >
                  <div className="absolute left-3 top-3 z-30 rounded-md bg-white/90 px-2 py-1 text-[11px] font-black text-gray-600 shadow-sm dark:bg-gray-950/90 dark:text-gray-300">
                    {Math.round(canvasZoom * 100)}%
                  </div>
                  <svg className="absolute inset-0 pointer-events-none" width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
                    <defs>
                      <marker id="procedure-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill="currentColor" />
                      </marker>
                    </defs>
                    {draft.edges.map(edge => {
                      const from = nodeMap.get(edge.fromNodeId);
                      const to = nodeMap.get(edge.toNodeId);
                      if (!from || !to) return null;
                      const { start, end } = getEdgePoints(edge, from, to);
                      const edgePath = getConnectionPath(start, end, edge.fromAnchor, edge.toAnchor);
                      const colorClass = edge.id === selectedEdgeId
                        ? 'text-indigo-600'
                        : edge.outcome === 'success'
                          ? 'text-emerald-500'
                          : edge.outcome === 'failure'
                            ? 'text-red-500'
                            : 'text-gray-500';

                      return (
                        <g key={edge.id} className={colorClass}>
                          <path
                            d={edgePath}
                            fill="none"
                            stroke="transparent"
                            strokeWidth="16"
                            className="pointer-events-auto cursor-pointer"
                            style={{ pointerEvents: 'stroke' }}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              setSelectedEdgeId(edge.id);
                              setSelectedNodeId(null);
                            }}
                          />
                          <path
                            d={edgePath}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={edge.id === selectedEdgeId ? 3 : 2}
                            markerEnd="url(#procedure-arrow)"
                            className="pointer-events-auto cursor-pointer"
                            style={{ pointerEvents: 'stroke' }}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              setSelectedEdgeId(edge.id);
                              setSelectedNodeId(null);
                            }}
                          />
                        </g>
                      );
                    })}
                    {connectorDraft && (() => {
                      const from = nodeMap.get(connectorDraft.fromNodeId);
                      if (!from) return null;
                      const start = getNodeAnchorPoint(from, connectorDraft.fromAnchor);
                      return (
                        <path
                          d={`M ${start.x} ${start.y} L ${connectorDraft.pointerX} ${connectorDraft.pointerY}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeDasharray="6 6"
                          className="text-emerald-500"
                          markerEnd="url(#procedure-arrow)"
                        />
                      );
                    })()}
                  </svg>

                  {draft.edges.map(edge => {
                    const from = nodeMap.get(edge.fromNodeId);
                    const to = nodeMap.get(edge.toNodeId);
                    if (!from || !to || edge.labelHidden) return null;
                    const { start, end } = getEdgePoints(edge, from, to);
                    const labelPosition = edge.labelPosition || getDefaultEdgeLabelPosition(start, end);
                    const labelSize = getEdgeLabelSize(edge);
                    return (
                      <div
                        key={`${edge.id}-label`}
                        className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-md border bg-white shadow-sm dark:bg-gray-950 ${
                          edge.id === selectedEdgeId ? 'border-indigo-400' : 'border-gray-200 dark:border-gray-700'
                        }`}
                        style={{
                          left: labelPosition.x,
                          top: labelPosition.y,
                          width: labelSize.width,
                          height: labelSize.height,
                        }}
                        title="Etykieta powiazania"
                      >
                        <button
                          type="button"
                          onPointerDown={(event) => startEdgeLabelDrag(event, edge, labelPosition)}
                          className="absolute -left-1.5 -top-1.5 z-10 inline-flex h-5 w-5 cursor-grab items-center justify-center rounded-sm border border-indigo-300 bg-white text-indigo-600 shadow-sm active:cursor-grabbing dark:bg-gray-900"
                          title="Przesun etykiete"
                        >
                          <Hand size={12} />
                        </button>
                        {edge.id === selectedEdgeId && (
                          <button
                            type="button"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              setEdgePatch(edge.id, { labelHidden: true });
                            }}
                            className="absolute -right-1.5 -top-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-sm border border-red-300 bg-white text-red-600 shadow-sm dark:bg-gray-900"
                            title="Ukryj etykiete"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        <textarea
                          value={edge.label ?? outcomeLabels[edge.outcome]}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            setSelectedEdgeId(edge.id);
                            setSelectedNodeId(null);
                          }}
                          onChange={(event) => setEdgePatch(edge.id, { label: event.target.value })}
                          className="h-full w-full resize-none rounded-md bg-transparent px-2 py-1 text-center text-[11px] font-bold leading-4 text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                        />
                        <button
                          type="button"
                          onPointerDown={(event) => startEdgeLabelResize(event, edge)}
                          className="absolute -bottom-1.5 -right-1.5 h-4 w-4 rounded-sm border border-indigo-300 bg-white shadow-sm cursor-se-resize dark:bg-gray-900"
                          title="Rozszerz etykiete"
                        />
                      </div>
                    );
                  })}

                  {draft.nodes.map(node => {
                    const Icon = getNodeIcon(node.type);
                    const nodeSize = getNodeSize(node);

                    return (
                      <div
                        key={node.id}
                        className={`absolute z-20 flex cursor-grab flex-col rounded-lg border-2 shadow-sm active:cursor-grabbing ${node.type === 'text' ? 'p-2' : 'p-3'} ${getNodeClasses(node.type, selectedNodeId === node.id)}`}
                        style={{ left: node.position.x, top: node.position.y, width: nodeSize.width, height: nodeSize.height }}
                        onPointerDown={(event) => handleNodePointerDown(event, node)}
                        onPointerUp={(event) => handleNodePointerUp(event, node)}
                      >
                        {node.type === 'text' ? (
                          <textarea
                            value={node.title}
                            onPointerDown={(event) => event.stopPropagation()}
                            onChange={(event) => setNodePatch(node.id, { title: event.target.value })}
                            className="min-h-0 flex-1 resize-none rounded border border-transparent bg-transparent px-2 py-1 text-sm font-bold leading-5 outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-400"
                            title="Tekst etykiety"
                          />
                        ) : (
                          <>
                            <div className="flex items-start gap-2">
                              <Icon size={18} className="mt-1 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-black uppercase tracking-wide opacity-70">{nodeTypeLabels[node.type]}</p>
                                <input
                                  value={node.title}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onChange={(event) => setNodePatch(node.id, { title: event.target.value })}
                                  className="mt-0.5 w-full rounded border border-transparent bg-white/60 px-1 py-0.5 text-sm font-black outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-400 dark:bg-black/20"
                                  title="Tytul elementu"
                                />
                              </div>
                            </div>
                            <textarea
                              value={node.description || ''}
                              onPointerDown={(event) => event.stopPropagation()}
                              onChange={(event) => setNodePatch(node.id, { description: event.target.value })}
                              className="mt-2 min-h-0 flex-1 resize-none rounded border border-transparent bg-white/50 px-2 py-1 text-xs leading-4 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-400 dark:bg-black/20"
                              title="Opis elementu"
                            />
                          </>
                        )}
                        {node.type !== 'text' && selectedNodeId === node.id && !connectorDraft && (
                          <>
                            {NODE_ANCHORS.map(anchor => {
                              const style =
                                anchor === 'top'
                                  ? { left: '50%', top: 0, transform: 'translate(-50%, -50%)' }
                                  : anchor === 'right'
                                    ? { right: 0, top: '50%', transform: 'translate(50%, -50%)' }
                                    : anchor === 'bottom'
                                      ? { left: '50%', bottom: 0, transform: 'translate(-50%, 50%)' }
                                      : { left: 0, top: '50%', transform: 'translate(-50%, -50%)' };

                              return (
                                <button
                                  key={anchor}
                                  type="button"
                                  onPointerDown={(event) => startConnectorFromAnchor(event, node, anchor)}
                                  className="absolute z-30 h-3.5 w-3.5 rounded-[3px] border border-emerald-700 bg-emerald-400 shadow-sm ring-2 ring-white transition hover:scale-110 dark:border-emerald-300 dark:ring-gray-950"
                                  style={style}
                                  title="Utworz strzalke"
                                />
                              );
                            })}
                          </>
                        )}
                        <button
                          type="button"
                          onPointerDown={(event) => startNodeResize(event, node)}
                          className="absolute -bottom-1.5 -right-1.5 h-5 w-5 rounded-sm border border-indigo-300 bg-white shadow-sm cursor-se-resize dark:bg-gray-900"
                          title="Rozszerz kafelek"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">Procedura</h2>
                {selectedProcedure && (
                  <button type="button" onClick={() => void handleDeleteProcedure(selectedProcedure)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" title="Usun procedure">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <input
                value={draft.title}
                onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />
              <textarea
                value={draft.description || ''}
                onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                placeholder="Opis procedury..."
              />
            </section>

            {selectedNode && (
              <section className="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                <h2 className="text-sm font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">Zmienne w kroku</h2>
                {selectedElementVariables.length ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedElementVariables.map(token => (
                      <code key={token} className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">{`{{${token}}}`}</code>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Wpisz w tytule lub opisie np. {`{{para}}`}, aby utworzyc zmienna.</p>
                )}
              </section>
            )}

            {selectedEdge && (
              <section className="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">Powiazanie</h2>
                  <button type="button" onClick={handleDeleteEdge} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
                    <Trash2 size={14} />
                    Usun strzalke
                  </button>
                </div>
                <select
                  value={selectedEdge.outcome}
                  onChange={event => setEdgePatch(selectedEdge.id, { outcome: event.target.value as ProcedureFlowEdgeOutcome })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                >
                  {Object.entries(outcomeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setEdgePatch(selectedEdge.id, { labelHidden: !selectedEdge.labelHidden })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-950"
                >
                  {selectedEdge.labelHidden ? 'Pokaz etykiete' : 'Ukryj etykiete'}
                </button>
              </section>
            )}

            <section className="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
              <h2 className="text-sm font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">Zmienne wlasne</h2>
              {detectedCustomVariableTokens.length ? (
                <div className="flex flex-wrap gap-2">
                  {detectedCustomVariableTokens.map(token => (
                    <code key={token} className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">{`{{${token}}}`}</code>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">Nowe zmienne pojawia sie automatycznie po wpisaniu skladni {`{{nazwa_zmiennej}}`} w procedurze.</p>
              )}
            </section>

            <section className="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
              <h2 className="text-sm font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">Dostepne zmienne</h2>
              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {availableVariables.map(variable => (
                  <div key={variable.token} className="rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-950/50">
                    <button
                      type="button"
                      onClick={() => void handleCopyVariable(variable.token)}
                      className="flex w-full items-center justify-between gap-2 text-left"
                      title={`Kopiuj {{${variable.token}}}`}
                    >
                      <code className="min-w-0 truncate text-[11px] font-black text-indigo-700 dark:text-indigo-300">{`{{${variable.token}}}`}</code>
                      {copiedToken === variable.token ? (
                        <span className="text-[10px] font-black text-emerald-600">OK</span>
                      ) : (
                        <Copy size={13} className="shrink-0 text-gray-400" />
                      )}
                    </button>
                    {variable.aliases.length > 0 && (
                      <p className="mt-1 break-words text-[10px] text-gray-400">{variable.aliases.map(alias => `{{${alias}}}`).join(', ')}</p>
                    )}
                    <p className="mt-1 break-words text-xs font-semibold text-gray-700 dark:text-gray-200">{variable.value || 'brak wartosci'}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
        )}
      </div>
    </div>
  );
};
