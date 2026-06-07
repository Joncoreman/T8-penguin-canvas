export type PanoramaRatioId =
  | 'square'
  | 'portrait'
  | 'landscape'
  | 'portrait43'
  | 'landscape43'
  | 'story'
  | 'wide'
  | 'ultrawide'
  | 'ultratall'
  | 'custom';

export interface PanoramaRatio {
  w: number;
  h: number;
}

export const PANORAMA_RATIO_PRESETS: Record<Exclude<PanoramaRatioId, 'custom'>, PanoramaRatio> = {
  square: { w: 1, h: 1 },
  portrait: { w: 2, h: 3 },
  landscape: { w: 3, h: 2 },
  portrait43: { w: 3, h: 4 },
  landscape43: { w: 4, h: 3 },
  story: { w: 9, h: 16 },
  wide: { w: 16, h: 9 },
  ultrawide: { w: 21, h: 9 },
  ultratall: { w: 9, h: 21 },
};

export const PANORAMA_RATIO_OPTIONS: Array<{ id: PanoramaRatioId; label: string }> = [
  { id: 'square', label: '1:1' },
  { id: 'portrait', label: '2:3' },
  { id: 'landscape', label: '3:2' },
  { id: 'portrait43', label: '3:4' },
  { id: 'landscape43', label: '4:3' },
  { id: 'story', label: '9:16' },
  { id: 'wide', label: '16:9' },
  { id: 'ultrawide', label: '21:9' },
  { id: 'ultratall', label: '9:21' },
  { id: 'custom', label: '自定义' },
];

export type PanoramaGenerationMode = 'text' | 'image';
export type PanoramaPanelMode = 'preview' | PanoramaGenerationMode;
export type PanoramaSizeLevel = '1K' | '2K';

export interface PanoramaGenerationHistoryItem {
  url: string;
  mode: PanoramaGenerationMode;
  sizeLevel: PanoramaSizeLevel;
  prompt: string;
  promptFinal: string;
  referenceUrl?: string;
  createdAt: string;
}

export interface PanoramaCameraView {
  id: string;
  name: string;
  yaw: number;
  pitch: number;
  fov: number;
  isDefault?: boolean;
  snapshotUrl?: string;
  createdAt: string;
}

export interface PanoramaHotspot {
  id: string;
  label: string;
  yaw: number;
  pitch: number;
  fov?: number;
  targetNodeId?: string;
  targetYaw?: number;
  targetPitch?: number;
  targetFov?: number;
  createdAt: string;
}

export type PanoramaAvatarPoseId = string;

export type PanoramaAvatarFaceMode = 'camera' | 'heading';
export type PanoramaAvatarGroundMode = 'grounded' | 'floating' | 'manual';
export type PanoramaCompositionGuideId = 'off' | '16:9' | '9:16' | '1:1' | '4:3';
export type PanoramaShotCameraMode = 'panorama-view' | 'shot-camera';
export type PanoramaShotPresetId =
  | 'full-body'
  | 'two-shot-combat'
  | 'low-angle'
  | 'foot-closeup'
  | 'hand-closeup'
  | 'over-shoulder'
  | 'victim-pov';
export type PanoramaShotTargetBone =
  | 'body'
  | 'head'
  | 'torso'
  | 'pelvis'
  | 'leftHand'
  | 'rightHand'
  | 'leftFoot'
  | 'rightFoot';

export interface PanoramaShotCamera {
  mode: PanoramaShotCameraMode;
  presetId: PanoramaShotPresetId;
  targetAvatarId: string;
  targetBone: PanoramaShotTargetBone;
  framingRatio: PanoramaCompositionGuideId;
  closeupStrength: number;
  lowAngle: number;
}

export interface PanoramaAvatar {
  id: string;
  name: string;
  visible: boolean;
  yaw: number;
  pitch: number;
  distance: number;
  heightOffset: number;
  rootHeight: number;
  rootPitch: number;
  rootRoll: number;
  groundMode: PanoramaAvatarGroundMode;
  scale: number;
  heading: number;
  faceMode: PanoramaAvatarFaceMode;
  poseId: PanoramaAvatarPoseId;
  poseParams?: Record<string, number | string | boolean>;
  color: string;
  opacity: number;
  locked?: boolean;
  characterPrompt?: string;
  createdAt: string;
}

export interface PanoramaSceneSnapshotAvatar {
  id: string;
  name: string;
  color: string;
  yaw: number;
  pitch: number;
  distance: number;
  heightOffset: number;
  rootHeight: number;
  rootPitch: number;
  rootRoll: number;
  groundMode: PanoramaAvatarGroundMode;
  scale: number;
  heading: number;
  faceMode: PanoramaAvatarFaceMode;
  poseId: PanoramaAvatarPoseId;
  poseLabel: string;
  posePrompt: string;
  characterPrompt?: string;
  screen?: { visible: boolean; x: number; y: number };
}

export interface PanoramaAvatarKeyframe {
  id: string;
  label: string;
  avatarId: string;
  avatarName: string;
  time: number;
  yaw: number;
  pitch: number;
  distance: number;
  heightOffset: number;
  rootHeight: number;
  rootPitch: number;
  rootRoll: number;
  groundMode: PanoramaAvatarGroundMode;
  scale: number;
  heading: number;
  faceMode: PanoramaAvatarFaceMode;
  poseId: PanoramaAvatarPoseId;
  poseParams?: Record<string, number | string | boolean>;
  note?: string;
  createdAt: string;
}

export interface PanoramaSceneSnapshotKeyframe extends PanoramaAvatarKeyframe {
  poseLabel: string;
  posePrompt: string;
  screen?: { visible: boolean; x: number; y: number };
}

export interface PanoramaSceneSnapshotSequenceFrame {
  id: string;
  frameIndex: number;
  frameLabel: string;
  time: number;
  avatars: PanoramaSceneSnapshotKeyframe[];
  imageUrl?: string;
}

export interface PanoramaOcclusionMask {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  strength: number;
  note?: string;
  createdAt: string;
}

export interface PanoramaSceneSnapshot {
  schema: 't8-panorama-scene-snapshot';
  version: 1;
  background: {
    sourceUrl: string;
    promptFinal?: string;
    yaw: number;
    pitch: number;
    fov: number;
    ratio: string;
    width: number;
    height: number;
  };
  avatars: PanoramaSceneSnapshotAvatar[];
  keyframes: PanoramaSceneSnapshotKeyframe[];
  sequenceFrameCount: number;
  sequenceFrames: PanoramaSceneSnapshotSequenceFrame[];
  occlusionMasks: PanoramaOcclusionMask[];
  compositionGuide: PanoramaCompositionGuideId;
  shotCamera: PanoramaShotCamera;
  shotTarget?: { visible: boolean; x: number; y: number; label: string };
  promptText: string;
  snapshotUrl?: string;
  controlSnapshotUrl?: string;
  createdAt: string;
}

export type PanoramaActionPlanMode = 'append' | 'update-selected' | 'replace-actors';

export interface PanoramaActionPlanAvatar {
  ref: string;
  name?: string;
  color?: string;
  visible?: boolean;
  yaw?: number;
  pitch?: number;
  distance?: number;
  heightOffset?: number;
  rootHeight?: number;
  rootPitch?: number;
  rootRoll?: number;
  groundMode?: PanoramaAvatarGroundMode;
  scale?: number;
  heading?: number;
  faceMode?: PanoramaAvatarFaceMode;
  poseId?: PanoramaAvatarPoseId;
  poseParams?: Record<string, number | string | boolean>;
  opacity?: number;
  characterPrompt?: string;
  roleText?: string;
  confidence?: number;
}

export interface PanoramaActionPlanKeyframe {
  avatarRef: string;
  label?: string;
  time: number;
  yaw?: number;
  pitch?: number;
  distance?: number;
  heightOffset?: number;
  rootHeight?: number;
  rootPitch?: number;
  rootRoll?: number;
  groundMode?: PanoramaAvatarGroundMode;
  scale?: number;
  heading?: number;
  faceMode?: PanoramaAvatarFaceMode;
  poseId?: PanoramaAvatarPoseId;
  poseParams?: Record<string, number | string | boolean>;
  note?: string;
}

export interface PanoramaActionPlanShotCamera extends Partial<PanoramaShotCamera> {
  targetAvatarRef?: string;
}

export interface PanoramaActionPlan {
  schema: 't8-panorama-action-plan';
  version: 1;
  mode: PanoramaActionPlanMode;
  prompt: string;
  duration?: number;
  sequenceFrameCount?: number;
  avatars: PanoramaActionPlanAvatar[];
  keyframes?: PanoramaActionPlanKeyframe[];
  shotCamera?: PanoramaActionPlanShotCamera;
  occlusionMasks?: Partial<PanoramaOcclusionMask>[];
  notes?: string[];
  warnings?: string[];
}

export type PanoramaActionTermId = string;

export interface PanoramaActionTerm {
  id: PanoramaActionTermId;
  label: string;
  kind: 'pose' | 'relation' | 'shot';
  keywords: string[];
  poseId?: PanoramaAvatarPoseId;
  shotPresetId?: PanoramaShotPresetId;
  targetBone?: PanoramaShotTargetBone;
  description: string;
  avatarPatch?: Partial<PanoramaActionPlanAvatar>;
}

export type PanoramaAvatarPoseParams = Record<string, number | string | boolean>;
export type PanoramaAvatarPoseRootDefaults = Pick<PanoramaAvatar, 'groundMode' | 'rootHeight' | 'rootPitch' | 'rootRoll'>;

export interface PanoramaAvatarPoseDefinition {
  id: PanoramaAvatarPoseId;
  label: string;
  prompt: string;
  category?: string;
  keywords?: string[];
  startPoseId?: PanoramaAvatarPoseId;
  root?: Partial<PanoramaAvatarPoseRootDefaults>;
  poseParams?: PanoramaAvatarPoseParams;
}

export interface PanoramaPromptContext {
  viewerPosition?: unknown;
  viewCenter?: unknown;
}

export interface PanoramaViewAngles {
  yaw: number;
  pitch: number;
  fov: number;
}

export const PANORAMA_CAMERA_VIEW_LIMIT = 8;
export const PANORAMA_HOTSPOT_LIMIT = 16;
export const PANORAMA_AVATAR_LIMIT = 8;
export const PANORAMA_AVATAR_KEYFRAME_LIMIT = 24;
export const PANORAMA_OCCLUSION_MASK_LIMIT = 12;
export const PANORAMA_KEYFRAME_SEQUENCE_DEFAULT = 8;
export const PANORAMA_KEYFRAME_SEQUENCE_MAX = 48;

export const PANORAMA_SHOT_CAMERA_DEFAULT: PanoramaShotCamera = {
  mode: 'panorama-view',
  presetId: 'full-body',
  targetAvatarId: '',
  targetBone: 'body',
  framingRatio: '16:9',
  closeupStrength: 28,
  lowAngle: 10,
};

export type PanoramaQualityLevel = 'excellent' | 'good' | 'warning' | 'unknown';

export interface PanoramaImageQuality {
  level: PanoramaQualityLevel;
  seamScore: number | null;
  seamLabel: string;
  aspectLabel: string;
  width: number;
  height: number;
  hint: string;
}

export const PANORAMA_FIXED_PROMPT =
  '将参考图生成一个720度的全景VR图，左右边缘100%像素级无缝衔接，可无限循环拼接；上下极点（南北极）自然过渡，无明显断层或拉伸，场景一致性，以及场景的逻辑性，封闭场景需要有门。';

export const PANORAMA_SIZE_LEVELS: PanoramaSizeLevel[] = ['1K', '2K'];
export const PANORAMA_PROMPT_TEMPLATES = ['室内展厅', '科幻基地', '古风庭院', '自然峡谷', '游戏关卡', '产品展台'];
export const PANORAMA_CAMERA_PRESETS: Array<{ id: string; label: string; yaw: number; pitch: number; fov: number }> = [
  { id: 'front', label: '正前', yaw: 0, pitch: 0, fov: 75 },
  { id: 'left', label: '左侧', yaw: -90, pitch: 0, fov: 75 },
  { id: 'right', label: '右侧', yaw: 90, pitch: 0, fov: 75 },
  { id: 'back', label: '背面', yaw: 180, pitch: 0, fov: 75 },
  { id: 'zenith', label: '天顶', yaw: 0, pitch: 78, fov: 80 },
  { id: 'nadir', label: '地面', yaw: 0, pitch: -72, fov: 80 },
];

export const PANORAMA_AVATAR_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#f59e0b',
  '#22c55e',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

const PANORAMA_AVATAR_POSE_ROOT_DEFAULT: PanoramaAvatarPoseRootDefaults = {
  groundMode: 'grounded',
  rootHeight: 0,
  rootPitch: 0,
  rootRoll: 0,
};

function definePanoramaAvatarPose(
  id: PanoramaAvatarPoseId,
  label: string,
  prompt: string,
  options: Omit<PanoramaAvatarPoseDefinition, 'id' | 'label' | 'prompt'> = {},
): PanoramaAvatarPoseDefinition {
  const keywords = Array.from(new Set([label, id, ...(options.keywords || [])].filter(Boolean)));
  return { id, label, prompt, ...options, keywords };
}

const combatGuardParams: PanoramaAvatarPoseParams = {
  armLZ: -0.72,
  armRZ: 0.86,
  armLBendZ: -0.18,
  armRBendZ: 0.18,
  legLZ: -0.28,
  legRZ: 0.36,
  legLBendZ: -0.16,
  legRBendZ: 0.16,
};

export const PANORAMA_AVATAR_POSES: PanoramaAvatarPoseDefinition[] = [
  definePanoramaAvatarPose('standing', '站立', '自然站立，身体稳定，动作清晰', { category: '基础', root: PANORAMA_AVATAR_POSE_ROOT_DEFAULT }),
  definePanoramaAvatarPose('walking', '走路', '正在向前行走，一条腿迈出，身体有轻微前倾', {
    category: '基础',
    root: PANORAMA_AVATAR_POSE_ROOT_DEFAULT,
    keywords: ['行走', '走向'],
  }),
  definePanoramaAvatarPose('running', '奔跑', '快速奔跑，双臂摆动，身体明显前倾', {
    category: '基础',
    keywords: ['跑步', '冲刺', '追逐'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -3, rootRoll: 0 },
  }),
  definePanoramaAvatarPose('sitting', '坐下', '坐姿，膝盖弯曲，身体保持平衡', { category: '基础', keywords: ['坐着', '坐姿'] }),
  definePanoramaAvatarPose('wave', '挥手', '一只手举起挥手，动作友好醒目', { category: '手势', keywords: ['招手'] }),
  definePanoramaAvatarPose('pointing', '指向', '一只手臂伸出指向目标方向', { category: '手势', keywords: ['指着', '指路'] }),
  definePanoramaAvatarPose('look-back', '回头', '身体向前，头部和肩膀回头看向后方', { category: '表演', keywords: ['回望', '向后看'] }),
  definePanoramaAvatarPose('hold-object', '持物', '双手在身前持物或托举道具', { category: '道具', keywords: ['拿着', '托举', '抱着'] }),
  definePanoramaAvatarPose('talking', '对话', '面向另一个角色交流，手部有自然表达动作', { category: '表演', keywords: ['交流', '说话', '聊天'] }),
  definePanoramaAvatarPose('combat', '战斗', '战斗准备姿态，重心降低，双臂防御或蓄力', {
    category: '战斗',
    keywords: ['格斗', '对打', 'fight', 'battle'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -4, rootRoll: 0 },
    poseParams: combatGuardParams,
  }),
  definePanoramaAvatarPose('jump', '跳跃', '跳跃在空中，双腿离地，动作富有动势', {
    category: '基础',
    keywords: ['跳起', '跃起'],
    startPoseId: 'standing',
    root: { groundMode: 'floating', rootHeight: 36, rootPitch: 0, rootRoll: 0 },
  }),
  definePanoramaAvatarPose('crouch', '蹲下', '低身蹲下，膝盖弯曲，重心靠近地面', { category: '基础', keywords: ['蹲伏', '下蹲'] }),
  definePanoramaAvatarPose('flying-kick', '飞踢', '悬空飞踢，一条腿向目标伸出，另一条腿收起，身体有强烈倾斜动势', {
    category: '战斗',
    keywords: ['踢飞', '空中踢', '凌空踢'],
    startPoseId: 'combat',
    root: { groundMode: 'floating', rootHeight: 70, rootPitch: -16, rootRoll: 18 },
  }),
  definePanoramaAvatarPose('hit-back', '受击后仰', '被击中后身体后仰失衡，重心后移，手臂自然散开', {
    category: '战斗',
    keywords: ['受击', '后仰', '被打', '击退', '被踢', '被击中'],
    startPoseId: 'standing',
    root: { groundMode: 'manual', rootHeight: 8, rootPitch: 16, rootRoll: -8 },
  }),
  definePanoramaAvatarPose('kneel', '单膝跪地', '单膝跪地，身体前倾，一只手可支撑或保持平衡', { category: '基础', keywords: ['跪', '跪地', '单膝'] }),
  definePanoramaAvatarPose('lying', '倒地', '倒地或侧躺在地面附近，身体横向倾倒，动作关系清晰', {
    category: '基础',
    keywords: ['躺下', '摔倒', '趴下'],
    startPoseId: 'hit-back',
    root: { groundMode: 'manual', rootHeight: -22, rootPitch: 0, rootRoll: 86 },
  }),
  definePanoramaAvatarPose('sprint-start', '起跑', '压低重心准备冲刺，前脚发力，手臂后摆', {
    category: '基础',
    keywords: ['起跑姿势', '准备冲刺'],
    startPoseId: 'crouch',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -18, rootRoll: 0 },
    poseParams: { armLZ: -0.92, armRZ: 0.34, legLZ: -0.52, legRZ: 0.82, legLBendZ: -0.46, legRBendZ: 0.26 },
  }),
  definePanoramaAvatarPose('lunge-forward', '前冲弓步', '一脚向前大步压低重心，身体向目标方向推进', {
    category: '基础',
    keywords: ['弓步', '前冲', '跨步'],
    startPoseId: 'standing',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -10, rootRoll: 0 },
    poseParams: { armLZ: -0.38, armRZ: 0.58, legLZ: -0.7, legRZ: 0.28, legLBendZ: -0.38, legRBendZ: 0.12 },
  }),
  definePanoramaAvatarPose('dodge-left', '左闪避', '身体向左侧倾，避开来袭动作，双臂保持平衡', {
    category: '战斗',
    keywords: ['左躲', '左侧闪', '侧身躲开'],
    startPoseId: 'combat',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -5, rootRoll: -18 },
    poseParams: { armLZ: -0.28, armRZ: 0.74, legLZ: -0.48, legRZ: 0.2, legLBendZ: -0.38 },
  }),
  definePanoramaAvatarPose('dodge-right', '右闪避', '身体向右侧倾，避开来袭动作，双臂保持平衡', {
    category: '战斗',
    keywords: ['右躲', '右侧闪', '闪避'],
    startPoseId: 'combat',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -5, rootRoll: 18 },
    poseParams: { armLZ: -0.74, armRZ: 0.28, legLZ: -0.2, legRZ: 0.48, legRBendZ: 0.38 },
  }),
  definePanoramaAvatarPose('slide', '滑步', '身体贴近地面向前滑行，一腿伸出，一腿弯曲', {
    category: '基础',
    keywords: ['滑铲', '滑行', '滑步躲避'],
    startPoseId: 'running',
    root: { groundMode: 'manual', rootHeight: -12, rootPitch: -16, rootRoll: 4 },
    poseParams: { armLZ: -0.42, armRZ: 0.5, legLZ: -1.02, legRZ: 0.44, legRBendZ: 0.58 },
  }),
  definePanoramaAvatarPose('roll', '翻滚', '身体蜷缩向侧面翻滚，四肢收紧保护身体', {
    category: '基础',
    keywords: ['滚翻', '翻滚躲避', '侧滚'],
    startPoseId: 'crouch',
    root: { groundMode: 'manual', rootHeight: -6, rootPitch: -32, rootRoll: 48 },
    poseParams: { armLZ: -0.72, armRZ: 0.72, legLZ: -0.7, legRZ: 0.7, legLBendZ: -0.56, legRBendZ: 0.56 },
  }),
  definePanoramaAvatarPose('climb', '攀爬', '双手向上抓握，单腿踩踏支撑，身体贴近墙面', {
    category: '基础',
    keywords: ['爬墙', '攀登', '爬上去'],
    startPoseId: 'standing',
    root: { groundMode: 'manual', rootHeight: 20, rootPitch: -8, rootRoll: 0 },
    poseParams: { armLZ: -1.16, armRZ: 1.2, armLBendZ: -0.16, armRBendZ: 0.18, legLZ: -0.38, legRZ: 0.64, legRBendZ: 0.38 },
  }),
  definePanoramaAvatarPose('crawl', '匍匐', '身体贴近地面爬行，手肘和膝盖交替支撑', {
    category: '基础',
    keywords: ['爬行', '低姿匍匐', '匍匐前进'],
    startPoseId: 'crouch',
    root: { groundMode: 'manual', rootHeight: -20, rootPitch: -55, rootRoll: 0 },
    poseParams: { armLZ: -0.62, armRZ: 0.52, armLBendZ: -0.48, armRBendZ: 0.4, legLZ: -0.46, legRZ: 0.54, legLBendZ: -0.46, legRBendZ: 0.38 },
  }),
  definePanoramaAvatarPose('lean-forward', '前倾查看', '上身向前探出，像是在观察地面或靠近目标', {
    category: '表演',
    keywords: ['探身', '前倾', '查看'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -18, rootRoll: 0 },
    poseParams: { armLZ: -0.22, armRZ: 0.22, legLZ: -0.1, legRZ: 0.1 },
  }),
  definePanoramaAvatarPose('lean-back', '后仰躲避', '上身向后仰开，脚步仍在原地支撑', {
    category: '表演',
    keywords: ['后仰躲', '向后躲', '仰身'],
    startPoseId: 'standing',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: 18, rootRoll: 0 },
    poseParams: { armLZ: -0.44, armRZ: 0.44, legLZ: -0.14, legRZ: 0.14 },
  }),
  definePanoramaAvatarPose('reach-up', '向上伸手', '一只或双手向上伸展，像是够取高处物体', {
    category: '手势',
    keywords: ['伸手够', '举高手', '够高处'],
    poseParams: { armLZ: -1.18, armRZ: 1.08, armLBendZ: -0.06, armRBendZ: 0.08, legLZ: -0.08, legRZ: 0.08 },
  }),
  definePanoramaAvatarPose('reach-down', '弯腰拾取', '身体向下弯，手伸向地面准备拾取物体', {
    category: '道具',
    keywords: ['捡起', '拾取', '弯腰'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -28, rootRoll: 0 },
    poseParams: { armLZ: -0.36, armRZ: 0.74, armRBendZ: 0.18, legLZ: -0.18, legRZ: 0.22, legRBendZ: 0.12 },
  }),
  definePanoramaAvatarPose('push', '推开', '双手向前用力推出，身体重心压向前方', {
    category: '道具',
    keywords: ['推门', '推人', '推东西'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -8, rootRoll: 0 },
    poseParams: { armLZ: -1.0, armRZ: 1.0, armLBendZ: -0.02, armRBendZ: 0.02, legLZ: -0.3, legRZ: 0.28 },
  }),
  definePanoramaAvatarPose('pull', '拉拽', '双手向身体方向拉拽，身体向后借力', {
    category: '道具',
    keywords: ['拉起', '拉门', '拖拽'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: 8, rootRoll: 0 },
    poseParams: { armLZ: -0.72, armRZ: 0.72, armLBendZ: -0.62, armRBendZ: 0.62, legLZ: -0.34, legRZ: 0.34 },
  }),
  definePanoramaAvatarPose('lift-heavy', '举重物', '双手抱起或托起重物，膝盖微弯，身体用力', {
    category: '道具',
    keywords: ['搬重物', '抬东西', '抱起箱子'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -10, rootRoll: 0 },
    poseParams: { armLZ: -0.82, armRZ: 0.82, armLBendZ: -0.48, armRBendZ: 0.48, legLZ: -0.28, legRZ: 0.28, legLBendZ: -0.18, legRBendZ: 0.18 },
  }),
  definePanoramaAvatarPose('carry-box', '抱箱子', '双臂在胸前环抱物体，身体保持稳定', {
    category: '道具',
    keywords: ['搬箱子', '抱着盒子', '抱物'],
    poseParams: { armLZ: -0.68, armRZ: 0.68, armLBendZ: -0.54, armRBendZ: 0.54, legLZ: -0.1, legRZ: 0.1 },
  }),
  definePanoramaAvatarPose('throw-object', '投掷', '一只手向后蓄力，准备向前投掷物体', {
    category: '道具',
    keywords: ['扔出', '抛出', '投球'],
    startPoseId: 'standing',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -6, rootRoll: 8 },
    poseParams: { armLZ: -0.32, armRZ: 1.34, armRBendZ: 0.34, legLZ: -0.34, legRZ: 0.28 },
  }),
  definePanoramaAvatarPose('catch-object', '接住', '双手张开在身前接住飞来的物体', {
    category: '道具',
    keywords: ['接球', '接东西', '接住物体'],
    poseParams: { armLZ: -0.96, armRZ: 0.96, armLBendZ: -0.18, armRBendZ: 0.18, legLZ: -0.16, legRZ: 0.16 },
  }),
  definePanoramaAvatarPose('open-door', '开门', '一只手向侧前方伸出握门把，身体略微转向门', {
    category: '道具',
    keywords: ['打开门', '拉门把', '推门'],
    poseParams: { armLZ: -0.1, armRZ: 0.96, armRBendZ: 0.16, legLZ: -0.08, legRZ: 0.08 },
  }),
  definePanoramaAvatarPose('knock-door', '敲门', '一只手抬起在胸前敲门，身体面向门口', {
    category: '手势',
    keywords: ['敲击', '敲门动作'],
    poseParams: { armLZ: -0.1, armRZ: 0.82, armRBendZ: 0.5, legLZ: -0.08, legRZ: 0.08 },
  }),
  definePanoramaAvatarPose('salute', '敬礼', '一只手抬到额前敬礼，身体挺直', {
    category: '手势',
    keywords: ['军礼', '行礼'],
    poseParams: { armLZ: -0.08, armRZ: 1.24, armRBendZ: 0.72 },
  }),
  definePanoramaAvatarPose('bow', '鞠躬', '上身向前鞠躬，双臂自然下垂或贴近身体', {
    category: '手势',
    keywords: ['弯腰行礼', '道歉'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -30, rootRoll: 0 },
    poseParams: { armLZ: -0.12, armRZ: 0.12, legLZ: -0.06, legRZ: 0.06 },
  }),
  definePanoramaAvatarPose('handshake', '握手', '一只手向前伸出准备握手，身体友好前倾', {
    category: '手势',
    keywords: ['伸手握手', '打招呼'],
    poseParams: { armLZ: -0.12, armRZ: 0.98, armRBendZ: 0.14, legLZ: -0.08, legRZ: 0.08 },
  }),
  definePanoramaAvatarPose('hug', '拥抱', '双臂向前张开，身体向对方靠近', {
    category: '手势',
    keywords: ['抱住', '张开双臂'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -5, rootRoll: 0 },
    poseParams: { armLZ: -1.02, armRZ: 1.02, armLBendZ: -0.2, armRBendZ: 0.2 },
  }),
  definePanoramaAvatarPose('cheer', '欢呼', '双手高举庆祝，身体向上伸展', {
    category: '手势',
    keywords: ['庆祝', '胜利欢呼'],
    startPoseId: 'standing',
    poseParams: { armLZ: -1.38, armRZ: 1.38, armLBendZ: -0.08, armRBendZ: 0.08, legLZ: -0.2, legRZ: 0.2 },
  }),
  definePanoramaAvatarPose('clap', '鼓掌', '双手在胸前靠拢鼓掌，身体保持正面', {
    category: '手势',
    keywords: ['拍手', '鼓掌动作'],
    poseParams: { armLZ: -0.82, armRZ: 0.82, armLBendZ: -0.42, armRBendZ: 0.42 },
  }),
  definePanoramaAvatarPose('pray', '祈祷', '双手在胸前合十，身体安静内收', {
    category: '手势',
    keywords: ['合十', '祷告', '拜托'],
    poseParams: { armLZ: -0.72, armRZ: 0.72, armLBendZ: -0.52, armRBendZ: 0.52 },
  }),
  definePanoramaAvatarPose('shrug', '耸肩', '双手摊开表示不确定，肩膀轻微上提', {
    category: '表演',
    keywords: ['摊手', '无奈', '不知道'],
    poseParams: { armLZ: -0.92, armRZ: 0.92, armLBendZ: -0.34, armRBendZ: 0.34 },
  }),
  definePanoramaAvatarPose('thinking', '思考', '一只手靠近下巴，身体略微收敛', {
    category: '表演',
    keywords: ['沉思', '摸下巴'],
    poseParams: { armLZ: -0.1, armRZ: 1.0, armRBendZ: 0.78 },
  }),
  definePanoramaAvatarPose('surprised', '惊讶', '双臂张开，身体轻微后仰，表达突然受到惊吓', {
    category: '表演',
    keywords: ['吃惊', '震惊'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: 8, rootRoll: 0 },
    poseParams: { armLZ: -1.08, armRZ: 1.08, legLZ: -0.18, legRZ: 0.18 },
  }),
  definePanoramaAvatarPose('scared', '害怕后退', '身体后缩，双手挡在身前，像是害怕或退让', {
    category: '表演',
    keywords: ['害怕', '后退', '惊恐'],
    startPoseId: 'standing',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: 10, rootRoll: -4 },
    poseParams: { armLZ: -0.96, armRZ: 0.96, armLBendZ: -0.36, armRBendZ: 0.36, legLZ: -0.22, legRZ: 0.18 },
  }),
  definePanoramaAvatarPose('angry', '愤怒挥拳', '一只拳头举起，身体前倾，表达愤怒质问', {
    category: '表演',
    keywords: ['生气', '愤怒', '怒吼'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -6, rootRoll: 0 },
    poseParams: { armLZ: -0.28, armRZ: 1.28, armRBendZ: 0.58, legLZ: -0.18, legRZ: 0.18 },
  }),
  definePanoramaAvatarPose('crying', '掩面哭泣', '双手靠近脸部，身体微微蜷缩', {
    category: '表演',
    keywords: ['哭泣', '难过', '掩面'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -10, rootRoll: 0 },
    poseParams: { armLZ: -0.8, armRZ: 0.8, armLBendZ: -0.7, armRBendZ: 0.7 },
  }),
  definePanoramaAvatarPose('laughing', '大笑', '身体轻微后仰，一手扶腰或张开', {
    category: '表演',
    keywords: ['笑', '大笑', '哈哈'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: 8, rootRoll: 0 },
    poseParams: { armLZ: -0.54, armRZ: 0.96, armLBendZ: -0.3, armRBendZ: 0.26 },
  }),
  definePanoramaAvatarPose('whisper', '耳语', '一只手靠近嘴边，身体向旁边倾斜说悄悄话', {
    category: '表演',
    keywords: ['悄悄话', '小声说'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -4, rootRoll: 8 },
    poseParams: { armLZ: -0.1, armRZ: 1.04, armRBendZ: 0.7 },
  }),
  definePanoramaAvatarPose('phone-call', '打电话', '一只手靠近耳边，另一手自然放下', {
    category: '道具',
    keywords: ['接电话', '手机通话'],
    poseParams: { armLZ: -0.08, armRZ: 1.16, armRBendZ: 0.68 },
  }),
  definePanoramaAvatarPose('take-photo', '拍照', '双手举起相机或手机对准前方', {
    category: '道具',
    keywords: ['拍摄', '举相机', '拍照片'],
    poseParams: { armLZ: -0.92, armRZ: 0.92, armLBendZ: -0.56, armRBendZ: 0.56 },
  }),
  definePanoramaAvatarPose('selfie', '自拍', '一只手举高伸出手机，身体面向镜头', {
    category: '道具',
    keywords: ['自拍照', '举手机自拍'],
    poseParams: { armLZ: -0.1, armRZ: 1.22, armRBendZ: 0.12, legLZ: -0.12, legRZ: 0.12 },
  }),
  definePanoramaAvatarPose('present', '展示物品', '一只手托举展示物品，另一手做介绍手势', {
    category: '道具',
    keywords: ['展示', '介绍产品', '递出'],
    poseParams: { armLZ: -0.72, armRZ: 0.98, armLBendZ: -0.32, armRBendZ: 0.1 },
  }),
  definePanoramaAvatarPose('beckon', '招呼靠近', '一只手向内招呼对方靠近，身体面向目标', {
    category: '手势',
    keywords: ['招呼', '过来', '召唤'],
    poseParams: { armLZ: -0.08, armRZ: 0.98, armRBendZ: 0.58 },
  }),
  definePanoramaAvatarPose('taekwondo-roundhouse', '跆拳道横踢', '跆拳道横踢，支撑腿稳定，踢腿从侧面扫向目标', {
    category: '武术',
    keywords: ['跆拳道', '横踢', '鞭腿', '旋踢', 'roundhouse kick'],
    startPoseId: 'combat',
    root: { groundMode: 'floating', rootHeight: 22, rootPitch: -6, rootRoll: 28 },
    poseParams: { ...combatGuardParams, armLZ: -0.38, armRZ: 0.54, legLZ: -0.28, legRZ: 1.34, legLBendZ: -0.18, legRBendZ: 0.04 },
  }),
  definePanoramaAvatarPose('taekwondo-front-kick', '跆拳道前踢', '跆拳道前踢，一腿直线向前上方踢出，身体保持直立', {
    category: '武术',
    keywords: ['前踢', '正踢', 'front kick', '跆拳道前踢'],
    startPoseId: 'combat',
    root: { groundMode: 'floating', rootHeight: 18, rootPitch: -4, rootRoll: 6 },
    poseParams: { ...combatGuardParams, legLZ: -0.22, legRZ: 1.18, legRBendZ: 0.02, armLZ: -0.62, armRZ: 0.72 },
  }),
  definePanoramaAvatarPose('taekwondo-side-kick', '跆拳道侧踢', '跆拳道侧踢，身体侧向打开，踢腿水平向外蹬出', {
    category: '武术',
    keywords: ['侧踢', '侧蹬', 'side kick', '跆拳道侧踢'],
    startPoseId: 'combat',
    root: { groundMode: 'floating', rootHeight: 24, rootPitch: -4, rootRoll: 36 },
    poseParams: { armLZ: -0.52, armRZ: 0.62, legLZ: -0.36, legRZ: 1.42, legLBendZ: -0.2, legRBendZ: 0 },
  }),
  definePanoramaAvatarPose('taekwondo-axe-kick', '跆拳道下劈', '跆拳道下劈腿，踢腿高高抬起后向下劈落', {
    category: '武术',
    keywords: ['下劈', '劈腿', 'axe kick', '跆拳道下劈'],
    startPoseId: 'combat',
    root: { groundMode: 'floating', rootHeight: 28, rootPitch: -2, rootRoll: 12 },
    poseParams: { armLZ: -0.48, armRZ: 0.64, legLZ: -0.22, legRZ: 1.58, legRBendZ: -0.12 },
  }),
  definePanoramaAvatarPose('taekwondo-back-kick', '跆拳道后踢', '跆拳道后踢，身体回转，一腿向身后蹬出', {
    category: '武术',
    keywords: ['后踢', '回身踢', 'back kick', '跆拳道后踢'],
    startPoseId: 'combat',
    root: { groundMode: 'floating', rootHeight: 22, rootPitch: -10, rootRoll: -24 },
    poseParams: { armLZ: -0.42, armRZ: 0.5, legLZ: -1.16, legRZ: 0.28, legLBendZ: -0.04, legRBendZ: 0.14 },
  }),
  definePanoramaAvatarPose('karate-punch', '空手道直拳', '空手道直拳，前手或后手沿直线击出，身体重心稳定', {
    category: '武术',
    keywords: ['空手道', '直拳', '冲拳'],
    startPoseId: 'combat',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -8, rootRoll: 4 },
    poseParams: { ...combatGuardParams, armRZ: 1.52, armRX: -0.08, armRBendZ: 0, armLZ: -0.58, armLBendZ: -0.42, legLZ: -0.44, legRZ: 0.42 },
  }),
  definePanoramaAvatarPose('karate-chop', '手刀劈砍', '一只手臂抬起做手刀劈砍，身体向目标压进', {
    category: '武术',
    keywords: ['手刀', '劈砍', 'karate chop'],
    startPoseId: 'combat',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -8, rootRoll: 0 },
    poseParams: { armLZ: -0.34, armRZ: 1.36, armRBendZ: 0.08, legLZ: -0.32, legRZ: 0.34 },
  }),
  definePanoramaAvatarPose('boxing-jab', '拳击刺拳', '前手快速刺拳，另一手护住头部，脚步轻盈', {
    category: '武术',
    keywords: ['刺拳', 'jab', '拳击'],
    startPoseId: 'combat',
    poseParams: { ...combatGuardParams, armLZ: -1.08, armLBendZ: -0.02, armRZ: 0.68, armRBendZ: 0.42 },
  }),
  definePanoramaAvatarPose('boxing-cross', '拳击后手直拳', '后手直拳向目标打出，身体带动肩膀旋转', {
    category: '武术',
    keywords: ['后手直拳', 'cross punch'],
    startPoseId: 'combat',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -7, rootRoll: 4 },
    poseParams: { ...combatGuardParams, armRZ: 1.16, armRBendZ: 0.02, armLZ: -0.56, armLBendZ: -0.42 },
  }),
  definePanoramaAvatarPose('boxing-hook', '拳击摆拳', '手臂弯曲从侧面横向摆出，身体扭转发力', {
    category: '武术',
    keywords: ['摆拳', 'hook punch'],
    startPoseId: 'combat',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -6, rootRoll: 8 },
    poseParams: { ...combatGuardParams, armRZ: 1.02, armRBendZ: 0.72, armLZ: -0.58 },
  }),
  definePanoramaAvatarPose('boxing-uppercut', '拳击上勾拳', '拳头从下向上勾击，身体压低后向上爆发', {
    category: '武术',
    keywords: ['上勾拳', 'uppercut'],
    startPoseId: 'combat',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -12, rootRoll: 0 },
    poseParams: { ...combatGuardParams, armRZ: 0.86, armRBendZ: 0.86, legLZ: -0.36, legRZ: 0.38 },
  }),
  definePanoramaAvatarPose('guard-block-high', '高位格挡', '双臂抬高护住头部，身体稳固防御', {
    category: '武术',
    keywords: ['高位防御', '挡头', '格挡'],
    startPoseId: 'combat',
    poseParams: { armLZ: -1.0, armRZ: 1.0, armLBendZ: -0.62, armRBendZ: 0.62, legLZ: -0.24, legRZ: 0.28 },
  }),
  definePanoramaAvatarPose('guard-block-low', '低位格挡', '一只手向下格挡，身体压低保护腹部和腿部', {
    category: '武术',
    keywords: ['低位防御', '挡腿', '下格挡'],
    startPoseId: 'combat',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -12, rootRoll: 0 },
    poseParams: { armLZ: -0.42, armRZ: 0.72, armRBendZ: 0.32, legLZ: -0.34, legRZ: 0.4 },
  }),
  definePanoramaAvatarPose('elbow-strike', '肘击', '手臂弯曲用肘部近距离攻击，身体向前压迫', {
    category: '武术',
    keywords: ['肘击', 'elbow strike'],
    startPoseId: 'combat',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -8, rootRoll: 6 },
    poseParams: { armRZ: 0.88, armRBendZ: 0.96, armLZ: -0.46, legLZ: -0.28, legRZ: 0.32 },
  }),
  definePanoramaAvatarPose('knee-strike', '膝击', '一膝向前抬起攻击，双手保持防御或抓握', {
    category: '武术',
    keywords: ['膝撞', '顶膝', 'knee strike'],
    startPoseId: 'combat',
    root: { groundMode: 'floating', rootHeight: 10, rootPitch: -7, rootRoll: 0 },
    poseParams: { armLZ: -0.72, armRZ: 0.72, armLBendZ: -0.36, armRBendZ: 0.36, legLZ: -0.18, legRZ: 0.98, legRBendZ: 0.92 },
  }),
  definePanoramaAvatarPose('spinning-backfist', '转身背拳', '身体回转，手臂从侧后方甩出背拳攻击', {
    category: '武术',
    keywords: ['背拳', '转身拳', 'spinning backfist'],
    startPoseId: 'combat',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -4, rootRoll: -18 },
    poseParams: { armLZ: -1.18, armRZ: 0.48, armLBendZ: -0.08, legLZ: -0.34, legRZ: 0.34 },
  }),
  definePanoramaAvatarPose('sword-slash', '挥剑斩击', '双手或单手持剑斜向斩击，身体带动挥砍弧线', {
    category: '武器',
    keywords: ['挥剑', '斩击', '砍击'],
    startPoseId: 'combat',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -8, rootRoll: 12 },
    poseParams: { armLZ: -1.04, armRZ: 1.2, armLBendZ: -0.22, armRBendZ: 0.12, legLZ: -0.34, legRZ: 0.36 },
  }),
  definePanoramaAvatarPose('staff-ready', '持棍戒备', '双手分开握棍横在身前，重心稳定戒备', {
    category: '武器',
    keywords: ['持棍', '长棍准备', '棍术'],
    poseParams: { armLZ: -0.82, armRZ: 0.82, armLBendZ: -0.24, armRBendZ: 0.24, legLZ: -0.22, legRZ: 0.24 },
  }),
  definePanoramaAvatarPose('staff-swing', '挥棍横扫', '双手握棍从侧面横扫，身体有明显旋转动势', {
    category: '武器',
    keywords: ['挥棍', '横扫', '扫棍'],
    startPoseId: 'staff-ready',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -7, rootRoll: -10 },
    poseParams: { armLZ: -1.14, armRZ: 1.08, armLBendZ: -0.18, armRBendZ: 0.18, legLZ: -0.32, legRZ: 0.34 },
  }),
  definePanoramaAvatarPose('shield-block', '盾牌格挡', '一臂在身前举盾格挡，另一臂保持平衡', {
    category: '武器',
    keywords: ['盾牌', '举盾', '盾挡'],
    poseParams: { armLZ: -1.02, armLBendZ: -0.28, armRZ: 0.42, legLZ: -0.24, legRZ: 0.24 },
  }),
  definePanoramaAvatarPose('gun-aim', '举枪瞄准', '双手持枪向前瞄准，肩膀稳定，视线锁定目标', {
    category: '武器',
    keywords: ['瞄准', '持枪', '枪口指向'],
    poseParams: { armLZ: -1.04, armRZ: 1.04, armLBendZ: -0.16, armRBendZ: 0.16, legLZ: -0.18, legRZ: 0.18 },
  }),
  definePanoramaAvatarPose('bow-draw', '拉弓', '一手持弓一手向后拉弦，身体侧向展开', {
    category: '武器',
    keywords: ['射箭', '弓箭', '拉弦'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -2, rootRoll: -8 },
    poseParams: { armLZ: -1.08, armRZ: 0.94, armRBendZ: 0.72, legLZ: -0.2, legRZ: 0.2 },
  }),
  definePanoramaAvatarPose('soccer-kick', '足球射门', '一脚支撑，一脚向前踢球，身体略微倾斜', {
    category: '运动',
    keywords: ['射门', '踢球', '足球'],
    startPoseId: 'running',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -6, rootRoll: 10 },
    poseParams: { armLZ: -0.56, armRZ: 0.7, legLZ: -0.26, legRZ: 1.12, legRBendZ: 0.04 },
  }),
  definePanoramaAvatarPose('basketball-shoot', '篮球投篮', '双手把球举到头上并向篮筐投出，膝盖微弯', {
    category: '运动',
    keywords: ['投篮', '篮球'],
    startPoseId: 'standing',
    poseParams: { armLZ: -1.24, armRZ: 1.24, armLBendZ: -0.32, armRBendZ: 0.32, legLZ: -0.18, legRZ: 0.18 },
  }),
  definePanoramaAvatarPose('basketball-dribble', '篮球运球', '身体压低，一手向下运球，另一手保持平衡', {
    category: '运动',
    keywords: ['运球', '拍球'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -14, rootRoll: 0 },
    poseParams: { armLZ: -0.28, armRZ: 0.82, armRBendZ: 0.42, legLZ: -0.34, legRZ: 0.36, legLBendZ: -0.24, legRBendZ: 0.24 },
  }),
  definePanoramaAvatarPose('baseball-bat', '棒球挥棒', '双手握棒大幅横向挥击，身体旋转发力', {
    category: '运动',
    keywords: ['棒球', '挥棒', '击球'],
    startPoseId: 'standing',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -6, rootRoll: -18 },
    poseParams: { armLZ: -1.08, armRZ: 1.02, armLBendZ: -0.34, armRBendZ: 0.34, legLZ: -0.32, legRZ: 0.32 },
  }),
  definePanoramaAvatarPose('tennis-forehand', '网球正手', '持拍手从身体侧面向前挥出，另一手保持平衡', {
    category: '运动',
    keywords: ['网球', '正手', '挥拍'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -5, rootRoll: 12 },
    poseParams: { armLZ: -0.42, armRZ: 1.24, armRBendZ: 0.08, legLZ: -0.28, legRZ: 0.3 },
  }),
  definePanoramaAvatarPose('tennis-backhand', '网球反手', '双手或单手从另一侧反手挥拍，身体横向展开', {
    category: '运动',
    keywords: ['反手', '反拍'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -5, rootRoll: -12 },
    poseParams: { armLZ: -1.18, armRZ: 0.84, armLBendZ: -0.1, armRBendZ: 0.16, legLZ: -0.3, legRZ: 0.28 },
  }),
  definePanoramaAvatarPose('golf-swing', '高尔夫挥杆', '双手握杆从侧后方向前挥动，身体旋转', {
    category: '运动',
    keywords: ['高尔夫', '挥杆'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -12, rootRoll: 16 },
    poseParams: { armLZ: -1.0, armRZ: 1.0, armLBendZ: -0.18, armRBendZ: 0.18, legLZ: -0.24, legRZ: 0.24 },
  }),
  definePanoramaAvatarPose('volleyball-spike', '排球扣杀', '空中抬臂扣球，一手高举向下击打', {
    category: '运动',
    keywords: ['排球', '扣球', '扣杀'],
    startPoseId: 'jump',
    root: { groundMode: 'floating', rootHeight: 54, rootPitch: -8, rootRoll: 8 },
    poseParams: { armLZ: -0.48, armRZ: 1.46, armRBendZ: 0.08, legLZ: -0.38, legRZ: 0.42, legLBendZ: -0.2, legRBendZ: 0.2 },
  }),
  definePanoramaAvatarPose('swim-stroke', '游泳划水', '身体横向前伸，一手向前一手向后划水', {
    category: '运动',
    keywords: ['游泳', '划水'],
    root: { groundMode: 'manual', rootHeight: -16, rootPitch: -70, rootRoll: 0 },
    poseParams: { armLZ: -1.18, armRZ: 0.74, legLZ: -0.18, legRZ: 0.2 },
  }),
  definePanoramaAvatarPose('skate-glide', '滑冰滑行', '身体侧向倾斜，一腿支撑一腿向后滑出', {
    category: '运动',
    keywords: ['滑冰', '轮滑', '滑行'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -8, rootRoll: -18 },
    poseParams: { armLZ: -0.78, armRZ: 0.78, legLZ: -0.18, legRZ: 0.74, legRBendZ: 0.12 },
  }),
  definePanoramaAvatarPose('ski-pose', '滑雪转弯', '身体前倾侧压，两臂分开保持平衡', {
    category: '运动',
    keywords: ['滑雪', '雪板', '转弯'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -15, rootRoll: -16 },
    poseParams: { armLZ: -0.88, armRZ: 0.88, legLZ: -0.24, legRZ: 0.24, legLBendZ: -0.2, legRBendZ: 0.2 },
  }),
  definePanoramaAvatarPose('cycling-lean', '骑行前倾', '双臂向前握把，身体前倾，双腿一上一下踩踏', {
    category: '运动',
    keywords: ['骑车', '自行车', '骑行'],
    root: { groundMode: 'manual', rootHeight: -6, rootPitch: -28, rootRoll: 0 },
    poseParams: { armLZ: -0.82, armRZ: 0.82, armLBendZ: -0.16, armRBendZ: 0.16, legLZ: -0.38, legRZ: 0.46, legLBendZ: -0.44, legRBendZ: 0.3 },
  }),
  definePanoramaAvatarPose('dance-step', '舞步', '一腿侧点地，双臂打开形成节奏感', {
    category: '表演',
    keywords: ['跳舞', '舞蹈', '舞步'],
    poseParams: { armLZ: -1.02, armRZ: 1.0, legLZ: -0.26, legRZ: 0.58, legRBendZ: 0.12 },
  }),
  definePanoramaAvatarPose('dance-spin', '旋转舞步', '身体旋转，双臂打开，一脚作为轴心', {
    category: '表演',
    keywords: ['转圈', '旋转', '旋舞'],
    startPoseId: 'dance-step',
    root: { groundMode: 'floating', rootHeight: 8, rootPitch: 0, rootRoll: 20 },
    poseParams: { armLZ: -1.18, armRZ: 1.18, legLZ: -0.28, legRZ: 0.46 },
  }),
  definePanoramaAvatarPose('ballet-arabesque', '芭蕾燕式', '一腿向后高抬，双臂优雅展开，身体前倾保持平衡', {
    category: '表演',
    keywords: ['芭蕾', '燕式平衡', 'arabesque'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -18, rootRoll: 0 },
    poseParams: { armLZ: -1.08, armRZ: 1.08, legLZ: -0.1, legRZ: 1.02, legRBendZ: 0.02 },
  }),
  definePanoramaAvatarPose('hiphop-pose', '街舞定格', '身体倾斜定格，双臂一高一低形成街舞造型', {
    category: '表演',
    keywords: ['街舞', 'hiphop', '定格'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -8, rootRoll: -20 },
    poseParams: { armLZ: -1.22, armRZ: 0.54, armLBendZ: -0.16, armRBendZ: 0.48, legLZ: -0.44, legRZ: 0.26 },
  }),
  definePanoramaAvatarPose('microphone-sing', '持麦演唱', '一手持麦靠近嘴边，另一手向外展开表演', {
    category: '表演',
    keywords: ['唱歌', '麦克风', '演唱'],
    poseParams: { armLZ: -0.8, armRZ: 1.0, armLBendZ: -0.14, armRBendZ: 0.72 },
  }),
  definePanoramaAvatarPose('guitar-play', '弹吉他', '双手在胸前持琴，一手按弦一手拨弦', {
    category: '表演',
    keywords: ['吉他', '弹奏'],
    poseParams: { armLZ: -0.78, armRZ: 0.78, armLBendZ: -0.5, armRBendZ: 0.5, legLZ: -0.1, legRZ: 0.1 },
  }),
  definePanoramaAvatarPose('drum-hit', '击鼓', '双臂抬起准备向下敲击鼓面', {
    category: '表演',
    keywords: ['打鼓', '鼓槌', '敲鼓'],
    startPoseId: 'standing',
    poseParams: { armLZ: -1.14, armRZ: 1.14, armLBendZ: -0.28, armRBendZ: 0.28 },
  }),
  definePanoramaAvatarPose('conductor', '指挥', '双手在身前一高一低做指挥动作', {
    category: '表演',
    keywords: ['指挥乐队', '挥拍'],
    poseParams: { armLZ: -0.86, armRZ: 1.08, armLBendZ: -0.26, armRBendZ: 0.36 },
  }),
  definePanoramaAvatarPose('yoga-tree', '瑜伽树式', '单腿站立，另一脚贴近支撑腿，双手上举合拢', {
    category: '表演',
    keywords: ['瑜伽', '树式'],
    poseParams: { armLZ: -1.28, armRZ: 1.28, armLBendZ: -0.1, armRBendZ: 0.1, legLZ: -0.04, legRZ: 0.74, legRBendZ: 0.62 },
  }),
  definePanoramaAvatarPose('yoga-warrior', '瑜伽战士式', '前后弓步，双臂前后或左右展开，身体稳定', {
    category: '表演',
    keywords: ['战士式', '瑜伽战士'],
    poseParams: { armLZ: -1.08, armRZ: 1.08, legLZ: -0.62, legRZ: 0.32, legLBendZ: -0.28 },
  }),
  definePanoramaAvatarPose('stretch', '拉伸', '一手越过头顶侧向拉伸，身体形成弧线', {
    category: '表演',
    keywords: ['伸展', '热身'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: 0, rootRoll: -16 },
    poseParams: { armLZ: -1.28, armRZ: 0.64, legLZ: -0.1, legRZ: 0.1 },
  }),
  definePanoramaAvatarPose('plank', '平板支撑', '身体近乎水平，手臂支撑地面，双腿向后伸直', {
    category: '表演',
    keywords: ['平板', '俯撑'],
    root: { groundMode: 'manual', rootHeight: -18, rootPitch: -72, rootRoll: 0 },
    poseParams: { armLZ: -0.36, armRZ: 0.36, armLBendZ: -0.08, armRBendZ: 0.08, legLZ: -0.08, legRZ: 0.08 },
  }),
  definePanoramaAvatarPose('sit-floor', '席地而坐', '坐在地面上，双腿弯曲或交叉，身体放松', {
    category: '剧情',
    keywords: ['坐地上', '盘坐', '地面坐姿'],
    root: { groundMode: 'manual', rootHeight: -18, rootPitch: 0, rootRoll: 0 },
    poseParams: { armLZ: -0.2, armRZ: 0.2, legLZ: -0.64, legRZ: 0.64, legLBendZ: -0.58, legRBendZ: 0.58 },
  }),
  definePanoramaAvatarPose('crawl-injured', '受伤爬行', '身体贴近地面，一手撑地一手护住身体，动作吃力', {
    category: '剧情',
    keywords: ['受伤爬', '艰难爬行'],
    startPoseId: 'lying',
    root: { groundMode: 'manual', rootHeight: -18, rootPitch: -55, rootRoll: -10 },
    poseParams: { armLZ: -0.72, armRZ: 0.42, armLBendZ: -0.52, armRBendZ: 0.18, legLZ: -0.48, legRZ: 0.28 },
  }),
  definePanoramaAvatarPose('stumble', '踉跄', '身体失衡向一侧倾倒，一脚急忙支撑', {
    category: '剧情',
    keywords: ['踉跄', '失衡', '跌跌撞撞'],
    startPoseId: 'walking',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: 10, rootRoll: -24 },
    poseParams: { armLZ: -0.92, armRZ: 0.74, legLZ: -0.34, legRZ: 0.18 },
  }),
  definePanoramaAvatarPose('fall-forward', '向前摔倒', '身体向前扑倒，双手伸出准备撑地', {
    category: '剧情',
    keywords: ['前摔', '扑倒', '向前倒'],
    startPoseId: 'stumble',
    root: { groundMode: 'manual', rootHeight: -8, rootPitch: -58, rootRoll: 0 },
    poseParams: { armLZ: -1.08, armRZ: 1.08, legLZ: -0.28, legRZ: 0.34 },
  }),
  definePanoramaAvatarPose('fall-backward', '向后摔倒', '身体向后倒下，双手自然张开保持平衡', {
    category: '剧情',
    keywords: ['后摔', '向后倒', '仰倒'],
    startPoseId: 'hit-back',
    root: { groundMode: 'manual', rootHeight: -8, rootPitch: 48, rootRoll: 0 },
    poseParams: { armLZ: -1.02, armRZ: 1.02, legLZ: -0.28, legRZ: 0.28 },
  }),
  definePanoramaAvatarPose('superhero-takeoff', '超级英雄起飞', '一拳向上，身体离地向前上方起飞', {
    category: '剧情',
    keywords: ['起飞', '超人起飞', '飞起'],
    startPoseId: 'crouch',
    root: { groundMode: 'floating', rootHeight: 62, rootPitch: -30, rootRoll: 0 },
    poseParams: { armLZ: -0.3, armRZ: 1.44, armRBendZ: 0.02, legLZ: -0.28, legRZ: 0.34 },
  }),
  definePanoramaAvatarPose('hero-landing', '英雄落地', '单膝或低身落地，一手触地，动作有冲击力', {
    category: '剧情',
    keywords: ['英雄落地', '落地姿势', '超级英雄落地'],
    startPoseId: 'jump',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -24, rootRoll: 0 },
    poseParams: { armLZ: -0.2, armRZ: 0.72, armRBendZ: 0.42, legLZ: -0.56, legRZ: 0.48, legLBendZ: -0.5, legRBendZ: 0.44 },
  }),
  definePanoramaAvatarPose('villain-loom', '反派压迫', '身体前倾俯视目标，双臂下垂或张开制造压迫感', {
    category: '剧情',
    keywords: ['压迫感', '反派', '俯视'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -18, rootRoll: 0 },
    poseParams: { armLZ: -0.56, armRZ: 0.56, legLZ: -0.18, legRZ: 0.18 },
  }),
  definePanoramaAvatarPose('sneak', '潜行', '低身小步前进，双手保持平衡，动作隐蔽', {
    category: '剧情',
    keywords: ['偷偷走', '潜入', '潜行'],
    startPoseId: 'crouch',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -16, rootRoll: 0 },
    poseParams: { armLZ: -0.46, armRZ: 0.62, legLZ: -0.34, legRZ: 0.4, legLBendZ: -0.28, legRBendZ: 0.22 },
  }),
  definePanoramaAvatarPose('tiptoe', '踮脚', '脚尖着地轻轻前进，双臂微张保持平衡', {
    category: '剧情',
    keywords: ['踮脚走', '轻手轻脚'],
    poseParams: { armLZ: -0.64, armRZ: 0.64, legLZ: -0.2, legRZ: 0.26, legLBendZ: -0.1, legRBendZ: 0.1 },
  }),
  definePanoramaAvatarPose('crouch-aim', '蹲姿瞄准', '低身蹲下并双手向前瞄准，适合掩体后动作', {
    category: '剧情',
    keywords: ['蹲着瞄准', '低姿瞄准'],
    startPoseId: 'crouch',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -10, rootRoll: 0 },
    poseParams: { armLZ: -0.98, armRZ: 0.98, armLBendZ: -0.14, armRBendZ: 0.14, legLZ: -0.48, legRZ: 0.48, legLBendZ: -0.52, legRBendZ: 0.52 },
  }),
  definePanoramaAvatarPose('cover-peek', '掩体探头', '身体从掩体侧面探出，一手扶墙一手准备动作', {
    category: '剧情',
    keywords: ['探头', '躲在掩体', '掩体后'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -4, rootRoll: 20 },
    poseParams: { armLZ: -0.58, armRZ: 0.86, armRBendZ: 0.28, legLZ: -0.18, legRZ: 0.18 },
  }),
  definePanoramaAvatarPose('drag-body', '拖拽伤员', '双手向后拉拽地面上的人或物，身体后仰用力', {
    category: '剧情',
    keywords: ['拖人', '拖走', '拖拽伤员'],
    startPoseId: 'pull',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: 14, rootRoll: 0 },
    poseParams: { armLZ: -0.86, armRZ: 0.86, armLBendZ: -0.62, armRBendZ: 0.62, legLZ: -0.36, legRZ: 0.36 },
  }),
  definePanoramaAvatarPose('carry-person', '背负同伴', '身体略微前倾，双臂固定身后或肩上重量', {
    category: '剧情',
    keywords: ['背人', '背负', '扛起同伴'],
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -18, rootRoll: 0 },
    poseParams: { armLZ: -0.68, armRZ: 0.68, armLBendZ: -0.58, armRBendZ: 0.58, legLZ: -0.22, legRZ: 0.22 },
  }),
  definePanoramaAvatarPose('protect-child', '护住身后', '一臂向侧前方挡住危险，身体保护身后的人', {
    category: '剧情',
    keywords: ['保护', '护住', '挡在前面'],
    poseParams: { armLZ: -1.16, armRZ: 0.58, armLBendZ: -0.12, armRBendZ: 0.28, legLZ: -0.26, legRZ: 0.22 },
  }),
  definePanoramaAvatarPose('inspect-ground', '检查地面', '蹲低或弯腰看向地面，一只手指向或触碰地面', {
    category: '剧情',
    keywords: ['检查地面', '查看地上', '找线索'],
    startPoseId: 'crouch',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -24, rootRoll: 0 },
    poseParams: { armLZ: -0.3, armRZ: 0.78, armRBendZ: 0.18, legLZ: -0.44, legRZ: 0.44 },
  }),
  definePanoramaAvatarPose('kneel-pray', '跪地祈祷', '双膝或单膝跪地，双手合十，姿态庄重', {
    category: '剧情',
    keywords: ['跪地祈祷', '跪拜', '求饶'],
    startPoseId: 'kneel',
    root: { groundMode: 'grounded', rootHeight: 0, rootPitch: -8, rootRoll: 0 },
    poseParams: { armLZ: -0.76, armRZ: 0.76, armLBendZ: -0.62, armRBendZ: 0.62, legLZ: -0.36, legRZ: 0.44, legLBendZ: -0.62, legRBendZ: 0.5 },
  }),
  definePanoramaAvatarPose('sleep', '睡觉', '身体侧躺或平躺，四肢放松', {
    category: '剧情',
    keywords: ['睡着', '躺着睡', '休息'],
    startPoseId: 'lying',
    root: { groundMode: 'manual', rootHeight: -24, rootPitch: 0, rootRoll: 88 },
    poseParams: { armLZ: -0.24, armRZ: 0.24, legLZ: -0.08, legRZ: 0.1 },
  }),
];

export const PANORAMA_COMPOSITION_GUIDES: Array<{ id: PanoramaCompositionGuideId; label: string; ratio: PanoramaRatio | null }> = [
  { id: 'off', label: '关闭', ratio: null },
  { id: '16:9', label: '16:9', ratio: { w: 16, h: 9 } },
  { id: '9:16', label: '9:16', ratio: { w: 9, h: 16 } },
  { id: '1:1', label: '1:1', ratio: { w: 1, h: 1 } },
  { id: '4:3', label: '4:3', ratio: { w: 4, h: 3 } },
];

export const PANORAMA_SHOT_PRESETS: Array<{
  id: PanoramaShotPresetId;
  label: string;
  targetBone: PanoramaShotTargetBone;
  framingRatio: PanoramaCompositionGuideId;
  closeupStrength: number;
  lowAngle: number;
  prompt: string;
}> = [
  { id: 'full-body', label: '全身动作', targetBone: 'body', framingRatio: '16:9', closeupStrength: 28, lowAngle: 10, prompt: 'full body action reference, the whole body is visible, readable pose silhouette' },
  { id: 'two-shot-combat', label: '双人打斗', targetBone: 'body', framingRatio: '16:9', closeupStrength: 42, lowAngle: 18, prompt: 'two-character action composition, clear combat relationship, both bodies readable' },
  { id: 'low-angle', label: '低机位', targetBone: 'body', framingRatio: '16:9', closeupStrength: 54, lowAngle: 72, prompt: 'low angle action shot, camera placed near the ground, powerful body scale' },
  { id: 'foot-closeup', label: '脚部特写', targetBone: 'rightFoot', framingRatio: '16:9', closeupStrength: 86, lowAngle: 84, prompt: 'low angle close-up on the foot, feet dominating foreground, body rising behind' },
  { id: 'hand-closeup', label: '手部特写', targetBone: 'rightHand', framingRatio: '4:3', closeupStrength: 78, lowAngle: 30, prompt: 'close-up on the hand gesture, hand dominates foreground, body context remains visible' },
  { id: 'over-shoulder', label: '肩后视角', targetBone: 'torso', framingRatio: '16:9', closeupStrength: 62, lowAngle: 26, prompt: 'over-the-shoulder action reference, foreground shoulder framing the target direction' },
  { id: 'victim-pov', label: '被击者视角', targetBone: 'head', framingRatio: '9:16', closeupStrength: 72, lowAngle: 52, prompt: 'victim point-of-view action shot, incoming attack feels close, dramatic perspective' },
];

export const PANORAMA_SHOT_TARGET_BONES: Array<{ id: PanoramaShotTargetBone; label: string; prompt: string }> = [
  { id: 'body', label: '全身', prompt: 'whole body' },
  { id: 'head', label: '头部', prompt: 'head and face' },
  { id: 'torso', label: '胸口', prompt: 'torso and chest' },
  { id: 'pelvis', label: '骨盆', prompt: 'pelvis and center of gravity' },
  { id: 'leftHand', label: '左手', prompt: 'left hand' },
  { id: 'rightHand', label: '右手', prompt: 'right hand' },
  { id: 'leftFoot', label: '左脚', prompt: 'left foot' },
  { id: 'rightFoot', label: '右脚', prompt: 'right foot' },
];

export const PANORAMA_ACTION_PLAN_SCHEMA = 't8-panorama-action-plan';

const PANORAMA_SPECIAL_ACTION_TERMS: PanoramaActionTerm[] = [
  {
    id: 'flying-kick',
    label: '飞踢',
    kind: 'relation',
    keywords: ['飞踢', '踢飞', '空中踢', '凌空踢', 'flying kick', 'fly kick'],
    poseId: 'flying-kick',
    description: '悬空飞踢，适合攻击者或高速动作角色。',
    avatarPatch: {
      poseId: 'flying-kick',
      groundMode: 'floating',
      rootHeight: 70,
      rootPitch: -16,
      rootRoll: 18,
      poseParams: {
        legROffsetZ: 0.42,
        legRBendOffsetZ: 0.18,
        legLOffsetZ: -0.38,
        legLBendOffsetZ: -0.52,
        armLOffsetZ: -0.26,
        armROffsetZ: 0.22,
      },
    },
  },
  {
    id: 'hit-back',
    label: '受击后仰',
    kind: 'relation',
    keywords: ['受击', '后仰', '被打', '击退', '被踢', '被击中', 'hit back', 'knockback', 'knocked back'],
    poseId: 'hit-back',
    description: '被击中后身体后仰失衡，适合受击者。',
    avatarPatch: {
      poseId: 'hit-back',
      groundMode: 'manual',
      rootHeight: 8,
      rootPitch: 16,
      rootRoll: -8,
      poseParams: {
        armLOffsetZ: -0.34,
        armROffsetZ: 0.34,
        legLOffsetZ: -0.22,
        legROffsetZ: 0.24,
      },
    },
  },
  {
    id: 'dodge',
    label: '闪避',
    kind: 'relation',
    keywords: ['闪避', '躲开', '躲避', '侧身躲', 'dodge', 'evade'],
    poseId: 'crouch',
    description: '侧身或低身闪避，可作为被攻击者的替代姿态。',
    avatarPatch: {
      poseId: 'crouch',
      groundMode: 'grounded',
      rootHeight: 0,
      rootPitch: -8,
      rootRoll: -16,
      poseParams: {
        armLOffsetZ: -0.18,
        armROffsetZ: 0.42,
        legLOffsetZ: -0.36,
        legROffsetZ: 0.2,
      },
    },
  },
  {
    id: 'help-up',
    label: '扶起',
    kind: 'relation',
    keywords: ['扶起', '搀扶', '扶着', '拉起', 'help up', 'helping up'],
    poseId: 'hold-object',
    description: '双手向前搀扶或拉起另一个角色。',
    avatarPatch: {
      poseId: 'hold-object',
      groundMode: 'grounded',
      rootHeight: 0,
      rootPitch: -5,
      poseParams: {
        armLOffsetZ: -0.48,
        armROffsetZ: 0.48,
        armLBendOffsetZ: -0.14,
        armRBendOffsetZ: 0.14,
      },
    },
  },
  {
    id: 'kneel',
    label: '单膝跪地',
    kind: 'pose',
    keywords: ['跪', '跪地', '单膝', 'kneel', 'kneeling'],
    poseId: 'kneel',
    description: '单膝跪地，适合受伤、落地或准备动作。',
    avatarPatch: { poseId: 'kneel', groundMode: 'grounded', rootHeight: 0, rootPitch: 0, rootRoll: 0 },
  },
  {
    id: 'lying',
    label: '倒地',
    kind: 'pose',
    keywords: ['倒地', '躺下', '摔倒', '趴下', 'lying', 'fallen'],
    poseId: 'lying',
    description: '倒地或侧躺，适合动作结果关键帧。',
    avatarPatch: { poseId: 'lying', groundMode: 'manual', rootHeight: -22, rootPitch: 0, rootRoll: 86 },
  },
  {
    id: 'jump',
    label: '跳跃',
    kind: 'pose',
    keywords: ['跳跃', '跳起', '跃起', 'jump', 'jumping'],
    poseId: 'jump',
    description: '角色离地跳跃。',
    avatarPatch: { poseId: 'jump', groundMode: 'floating', rootHeight: 36, rootPitch: 0, rootRoll: 0 },
  },
  {
    id: 'combat',
    label: '战斗',
    kind: 'pose',
    keywords: ['战斗', '格斗', '打斗', '对打', 'combat', 'fight', 'battle'],
    poseId: 'combat',
    description: '战斗准备或对峙姿态。',
    avatarPatch: { poseId: 'combat', groundMode: 'grounded', rootHeight: 0, rootPitch: -4, rootRoll: 0 },
  },
  {
    id: 'running',
    label: '奔跑',
    kind: 'pose',
    keywords: ['奔跑', '冲刺', '跑', 'running', 'run', 'sprint'],
    poseId: 'running',
    description: '快速奔跑或追逐。',
    avatarPatch: { poseId: 'running', groundMode: 'grounded', rootHeight: 0, rootPitch: -3, rootRoll: 0 },
  },
  {
    id: 'standing',
    label: '站立',
    kind: 'pose',
    keywords: ['站立', '站着', '自然站立', 'standing', 'stand'],
    poseId: 'standing',
    description: '自然站立，作为默认姿态或起始关键帧。',
    avatarPatch: { poseId: 'standing', groundMode: 'grounded', rootHeight: 0, rootPitch: 0, rootRoll: 0 },
  },
  {
    id: 'walking',
    label: '走路',
    kind: 'pose',
    keywords: ['走路', '行走', '走向', 'walking', 'walk'],
    poseId: 'walking',
    description: '自然行走。',
    avatarPatch: { poseId: 'walking', groundMode: 'grounded', rootHeight: 0, rootPitch: 0, rootRoll: 0 },
  },
  {
    id: 'sitting',
    label: '坐下',
    kind: 'pose',
    keywords: ['坐下', '坐着', '坐姿', 'sitting', 'sit'],
    poseId: 'sitting',
    description: '坐姿或半坐姿。',
    avatarPatch: { poseId: 'sitting', groundMode: 'grounded', rootHeight: 0, rootPitch: 0, rootRoll: 0 },
  },
  {
    id: 'wave',
    label: '挥手',
    kind: 'pose',
    keywords: ['挥手', '招手', 'wave', 'waving'],
    poseId: 'wave',
    description: '一只手举起挥手。',
    avatarPatch: { poseId: 'wave', groundMode: 'grounded', rootHeight: 0, rootPitch: 0, rootRoll: 0 },
  },
  {
    id: 'pointing',
    label: '指向',
    kind: 'pose',
    keywords: ['指向', '指着', '指路', 'point', 'pointing'],
    poseId: 'pointing',
    description: '一只手臂伸出指向目标。',
    avatarPatch: { poseId: 'pointing', groundMode: 'grounded', rootHeight: 0, rootPitch: 0, rootRoll: 0 },
  },
  {
    id: 'look-back',
    label: '回头',
    kind: 'pose',
    keywords: ['回头', '回望', '向后看', 'look back'],
    poseId: 'look-back',
    description: '头和肩膀回头看向后方。',
    avatarPatch: { poseId: 'look-back', groundMode: 'grounded', rootHeight: 0, rootPitch: 0, rootRoll: 0 },
  },
  {
    id: 'hold-object',
    label: '持物',
    kind: 'pose',
    keywords: ['持物', '拿着', '托举', '抱着', 'hold', 'holding'],
    poseId: 'hold-object',
    description: '双手持物、托举或抱住道具。',
    avatarPatch: { poseId: 'hold-object', groundMode: 'grounded', rootHeight: 0, rootPitch: 0, rootRoll: 0 },
  },
  {
    id: 'talking',
    label: '对话',
    kind: 'pose',
    keywords: ['对话', '交流', '说话', '聊天', 'talk', 'conversation'],
    poseId: 'talking',
    description: '面向另一个角色交流。',
    avatarPatch: { poseId: 'talking', groundMode: 'grounded', rootHeight: 0, rootPitch: 0, rootRoll: 0 },
  },
  {
    id: 'crouch',
    label: '蹲下',
    kind: 'pose',
    keywords: ['蹲下', '蹲伏', '下蹲', 'crouch', 'squat'],
    poseId: 'crouch',
    description: '低身蹲下。',
    avatarPatch: { poseId: 'crouch', groundMode: 'grounded', rootHeight: 0, rootPitch: 0, rootRoll: 0 },
  },
  {
    id: 'two-shot-combat',
    label: '双人打斗',
    kind: 'shot',
    keywords: ['双人打斗', '双人战斗', '两人打斗', '对打', 'two shot combat', 'two-character combat'],
    shotPresetId: 'two-shot-combat',
    targetBone: 'body',
    description: '双人动作关系构图，保证两人轮廓都可读。',
  },
  {
    id: 'foot-closeup',
    label: '脚部特写',
    kind: 'shot',
    keywords: ['脚部特写', '脚特写', '脚底特写', '鞋子特写', 'foot closeup', 'foot close-up', 'feet closeup'],
    shotPresetId: 'foot-closeup',
    targetBone: 'rightFoot',
    description: '低机位脚部特写，脚在前景成为主体。',
  },
  {
    id: 'hand-closeup',
    label: '手部特写',
    kind: 'shot',
    keywords: ['手部特写', '手特写', '手势特写', 'hand closeup', 'hand close-up'],
    shotPresetId: 'hand-closeup',
    targetBone: 'rightHand',
    description: '手势或手部动作特写。',
  },
  {
    id: 'low-angle',
    label: '低机位',
    kind: 'shot',
    keywords: ['低机位', '仰拍', '地面视角', 'low angle', 'low-angle'],
    shotPresetId: 'low-angle',
    targetBone: 'body',
    description: '近地低机位动作镜头。',
  },
  {
    id: 'over-shoulder',
    label: '肩后视角',
    kind: 'shot',
    keywords: ['肩后视角', '过肩', '肩膀后', 'over shoulder', 'over-the-shoulder'],
    shotPresetId: 'over-shoulder',
    targetBone: 'torso',
    description: '从角色肩后看向目标方向。',
  },
  {
    id: 'victim-pov',
    label: '被击者视角',
    kind: 'shot',
    keywords: ['被击者视角', '受击视角', '第一视角挨打', 'victim pov', 'victim point of view'],
    shotPresetId: 'victim-pov',
    targetBone: 'head',
    description: '被攻击者主观视角，攻击动作更近。',
  },
];

const PANORAMA_SPECIAL_ACTION_TERM_IDS = new Set(PANORAMA_SPECIAL_ACTION_TERMS.map((term) => term.id));

const PANORAMA_POSE_ACTION_TERMS: PanoramaActionTerm[] = PANORAMA_AVATAR_POSES
  .filter((pose) => !PANORAMA_SPECIAL_ACTION_TERM_IDS.has(pose.id))
  .map((pose) => {
    const root = panoramaAvatarPoseRootDefaults(pose.id);
    const poseParams = panoramaAvatarPoseDefaultParams(pose.id);
    return {
      id: pose.id,
      label: pose.label,
      kind: 'pose',
      keywords: pose.keywords || [pose.label, pose.id],
      poseId: pose.id,
      description: pose.prompt,
      avatarPatch: {
        poseId: pose.id,
        ...root,
        ...(poseParams ? { poseParams } : {}),
      },
    };
  });

export const PANORAMA_ACTION_TERMS: PanoramaActionTerm[] = [
  ...PANORAMA_SPECIAL_ACTION_TERMS,
  ...PANORAMA_POSE_ACTION_TERMS,
];

export function safePanoramaPanelMode(value: unknown): PanoramaPanelMode {
  return value === 'preview' || value === 'image' ? value : 'text';
}

export function safePanoramaGenerationMode(value: unknown): PanoramaGenerationMode {
  return value === 'image' ? 'image' : 'text';
}

export function safePanoramaSizeLevel(value: unknown): PanoramaSizeLevel {
  return value === '2K' ? '2K' : '1K';
}

function cleanPanoramaText(value: unknown, max = 80) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function buildPanoramaCameraContextPrompt(context: PanoramaPromptContext = {}) {
  const parts: string[] = [];
  const viewerPosition = cleanPanoramaText(context.viewerPosition);
  const viewCenter = cleanPanoramaText(context.viewCenter);
  if (viewerPosition) parts.push(`观看者站位：${viewerPosition}。`);
  if (viewCenter) parts.push(`初始视线中心：${viewCenter}。`);
  if (parts.length === 0) return '';
  return `摄像机位置要求：${parts.join('')}`;
}

export function buildPanoramaPromptFinal(userPrompt: unknown, context: PanoramaPromptContext = {}) {
  const extra = typeof userPrompt === 'string' ? userPrompt.trim() : '';
  const camera = buildPanoramaCameraContextPrompt(context);
  return [PANORAMA_FIXED_PROMPT, camera, extra].filter(Boolean).join('\n');
}

export function validatePanoramaGeneration(params: {
  mode: PanoramaGenerationMode;
  prompt?: unknown;
  referenceUrl?: unknown;
}) {
  const prompt = typeof params.prompt === 'string' ? params.prompt.trim() : '';
  const referenceUrl = typeof params.referenceUrl === 'string' ? params.referenceUrl.trim() : '';
  if (params.mode === 'text' && !prompt) {
    return { ok: false as const, error: '文生全景需要填写场景提示词' };
  }
  if (params.mode === 'image' && !referenceUrl) {
    return { ok: false as const, error: '图生全景需要上游图片或节点内参考图' };
  }
  return { ok: true as const };
}

export function buildPanoramaImageRequest(params: {
  mode: PanoramaGenerationMode;
  prompt?: unknown;
  sizeLevel?: unknown;
  referenceUrl?: unknown;
  viewerPosition?: unknown;
  viewCenter?: unknown;
}) {
  const prompt = typeof params.prompt === 'string' ? params.prompt.trim() : '';
  const referenceUrl = typeof params.referenceUrl === 'string' ? params.referenceUrl.trim() : '';
  const sizeLevel = safePanoramaSizeLevel(params.sizeLevel);
  return {
    model: 'gpt-image-2',
    apiModel: 'gpt-image-2',
    paramKind: 'gpt-size' as const,
    prompt: buildPanoramaPromptFinal(prompt, {
      viewerPosition: params.viewerPosition,
      viewCenter: params.viewCenter,
    }),
    aspectRatio: '21:9',
    aspect_ratio: '21:9',
    sizeLevel,
    image_size: sizeLevel,
    images: params.mode === 'image' && referenceUrl ? [referenceUrl] : [],
    n: 1,
  };
}

function makePanoramaId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanPanoramaName(value: unknown, fallback: string) {
  const text = cleanPanoramaText(value, 18);
  return text || fallback;
}

function cleanPanoramaColor(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

export function safePanoramaAvatarPose(value: unknown): PanoramaAvatarPoseId {
  return PANORAMA_AVATAR_POSES.some((pose) => pose.id === value)
    ? value as PanoramaAvatarPoseId
    : 'standing';
}

export function safePanoramaAvatarFaceMode(value: unknown): PanoramaAvatarFaceMode {
  return value === 'heading' ? 'heading' : 'camera';
}

export function safePanoramaAvatarGroundMode(value: unknown): PanoramaAvatarGroundMode {
  if (value === 'floating' || value === 'manual') return value;
  return 'grounded';
}

export function safePanoramaCompositionGuide(value: unknown): PanoramaCompositionGuideId {
  return PANORAMA_COMPOSITION_GUIDES.some((guide) => guide.id === value)
    ? value as PanoramaCompositionGuideId
    : 'off';
}

export function safePanoramaShotPreset(value: unknown): PanoramaShotPresetId {
  return PANORAMA_SHOT_PRESETS.some((preset) => preset.id === value)
    ? value as PanoramaShotPresetId
    : PANORAMA_SHOT_CAMERA_DEFAULT.presetId;
}

export function safePanoramaShotTargetBone(value: unknown): PanoramaShotTargetBone {
  return PANORAMA_SHOT_TARGET_BONES.some((bone) => bone.id === value)
    ? value as PanoramaShotTargetBone
    : PANORAMA_SHOT_CAMERA_DEFAULT.targetBone;
}

export function sanitizePanoramaShotCamera(value: unknown): PanoramaShotCamera {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const presetId = safePanoramaShotPreset(raw.presetId);
  const preset = PANORAMA_SHOT_PRESETS.find((item) => item.id === presetId) || PANORAMA_SHOT_PRESETS[0];
  const mode: PanoramaShotCameraMode = raw.mode === 'shot-camera' ? 'shot-camera' : 'panorama-view';
  const framingRatio = safePanoramaCompositionGuide(raw.framingRatio) === 'off'
    ? preset.framingRatio
    : safePanoramaCompositionGuide(raw.framingRatio);
  return {
    mode,
    presetId,
    targetAvatarId: cleanPanoramaText(raw.targetAvatarId, 48),
    targetBone: safePanoramaShotTargetBone(raw.targetBone || preset.targetBone),
    framingRatio,
    closeupStrength: clampPanoramaNumber(raw.closeupStrength, 0, 100, preset.closeupStrength),
    lowAngle: clampPanoramaNumber(raw.lowAngle, 0, 100, preset.lowAngle),
  };
}

export function panoramaAvatarPoseLabel(id: unknown) {
  const pose = PANORAMA_AVATAR_POSES.find((item) => item.id === id);
  return pose?.label || PANORAMA_AVATAR_POSES[0].label;
}

export function panoramaAvatarPosePrompt(id: unknown) {
  const pose = PANORAMA_AVATAR_POSES.find((item) => item.id === id);
  return pose?.prompt || PANORAMA_AVATAR_POSES[0].prompt;
}

export function panoramaAvatarPoseDefinition(id: unknown) {
  return PANORAMA_AVATAR_POSES.find((item) => item.id === id) || PANORAMA_AVATAR_POSES[0];
}

export function panoramaAvatarPoseRootDefaults(id: unknown): PanoramaAvatarPoseRootDefaults {
  const pose = panoramaAvatarPoseDefinition(id);
  return {
    ...PANORAMA_AVATAR_POSE_ROOT_DEFAULT,
    ...(pose.root || {}),
  };
}

export function panoramaAvatarPoseDefaultParams(id: unknown): PanoramaAvatarPoseParams | undefined {
  const pose = panoramaAvatarPoseDefinition(id);
  return pose.poseParams ? { ...pose.poseParams } : undefined;
}

export function panoramaAvatarPoseStartPose(id: unknown): PanoramaAvatarPoseId {
  const pose = panoramaAvatarPoseDefinition(id);
  return safePanoramaAvatarPose(pose.startPoseId || (pose.id === 'standing' ? 'standing' : 'standing'));
}

export function panoramaAvatarPoseIsDynamic(id: unknown) {
  const pose = panoramaAvatarPoseDefinition(id);
  if (pose.startPoseId && pose.startPoseId !== pose.id) return true;
  const root = panoramaAvatarPoseRootDefaults(pose.id);
  return root.groundMode !== 'grounded' || Math.abs(root.rootHeight) > 0 || Math.abs(root.rootPitch) > 6 || Math.abs(root.rootRoll) > 6;
}

function cleanPanoramaActionText(value: unknown, max = 220) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function inferPanoramaAvatarPoseFromText(value: unknown): PanoramaAvatarPoseId | null {
  const text = cleanPanoramaActionText(value, 1200);
  if (!text) return null;
  const term = inferPanoramaActionTerm(text, 'pose') || inferPanoramaActionTerm(text, 'relation');
  if (term?.poseId) return safePanoramaAvatarPose(term.poseId);
  let best: PanoramaAvatarPoseDefinition | null = null;
  let bestScore = 0;
  for (const pose of PANORAMA_AVATAR_POSES) {
    const score = (pose.keywords || [pose.label, pose.id]).reduce((sum, keyword) => sum + keywordScore(text, keyword), 0);
    if (score > bestScore) {
      best = pose;
      bestScore = score;
    }
  }
  return best ? best.id : null;
}

function cleanPanoramaActionRef(value: unknown, fallback: string) {
  const text = cleanPanoramaActionText(value, 24);
  return text || fallback;
}

function cleanPanoramaActionNotes(value: unknown, maxItems = 5) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return list
    .map((item) => cleanPanoramaActionText(item, 120))
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanPanoramaActionPoseParams(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const result: Record<string, number | string | boolean> = {};
  Object.entries(value as Record<string, unknown>).slice(0, 24).forEach(([key, raw]) => {
    const cleanKey = cleanPanoramaActionText(key, 48);
    if (!cleanKey) return;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      result[cleanKey] = Math.round(clampPanoramaNumber(raw, -3, 3, 0) * 1000) / 1000;
    } else if (typeof raw === 'boolean') {
      result[cleanKey] = raw;
    } else if (typeof raw === 'string') {
      const text = cleanPanoramaActionText(raw, 80);
      if (text) result[cleanKey] = text;
    }
  });
  return Object.keys(result).length ? result : undefined;
}

function mergePanoramaActionPoseParams(
  ...items: Array<Record<string, number | string | boolean> | undefined>
) {
  const merged = Object.assign({}, ...items.filter(Boolean));
  return Object.keys(merged).length ? merged : undefined;
}

function normalizePanoramaActionRoleToken(value: string, fallbackIndex: number) {
  const token = value.trim();
  const upper = token.toUpperCase();
  if (/^[A-H]$/.test(upper)) return `角色${upper}`;
  if (/^[1-8]$/.test(token)) return `角色${token}`;
  const cn: Record<string, string> = {
    一: '1',
    二: '2',
    三: '3',
    四: '4',
    五: '5',
    六: '6',
    七: '7',
    八: '8',
  };
  if (cn[token]) return `角色${cn[token]}`;
  return `角色${fallbackIndex + 1}`;
}

function panoramaActionRoleMatches(text: string) {
  const matches: Array<{ ref: string; index: number; end: number }> = [];
  const re = /角色\s*([A-Ha-h1-8一二三四五六七八])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    matches.push({
      ref: normalizePanoramaActionRoleToken(match[1], matches.length),
      index: match.index,
      end: match.index + match[0].length,
    });
  }
  return matches;
}

export function extractPanoramaActionRoleRefs(value: unknown) {
  const text = cleanPanoramaActionText(value, 2000);
  const refs: string[] = [];
  panoramaActionRoleMatches(text).forEach((match) => {
    if (!refs.includes(match.ref)) refs.push(match.ref);
  });
  return refs.slice(0, PANORAMA_AVATAR_LIMIT);
}

function roleSegmentText(text: string, ref: string) {
  const matches = panoramaActionRoleMatches(text);
  const segments: string[] = [];
  matches.forEach((match, index) => {
    if (match.ref !== ref) return;
    const next = matches[index + 1]?.index ?? text.length;
    let segment = text.slice(match.end, next);
    const punctuation = segment.search(/[，。；;,.!?！？\n]/);
    if (punctuation >= 0) segment = segment.slice(0, punctuation);
    segment = segment.trim();
    if (segment) segments.push(segment);
  });
  return segments.join(' ');
}

function keywordScore(text: string, keyword: string) {
  const source = text.toLowerCase();
  const target = keyword.toLowerCase();
  if (!target || !source.includes(target)) return 0;
  return Math.max(1, Math.min(6, target.length));
}

function scorePanoramaActionTerm(text: string, term: PanoramaActionTerm, kind?: PanoramaActionTerm['kind']) {
  if (kind && term.kind !== kind) return 0;
  return term.keywords.reduce((score, keyword) => score + keywordScore(text, keyword), 0);
}

export function inferPanoramaActionTerm(textValue: unknown, kind?: PanoramaActionTerm['kind']): PanoramaActionTerm | null {
  const text = cleanPanoramaActionText(textValue, 1200);
  let bestTerm: PanoramaActionTerm | null = null;
  let bestScore = 0;
  for (const term of PANORAMA_ACTION_TERMS) {
    const score = scorePanoramaActionTerm(text, term, kind);
    if (score > bestScore) {
      bestTerm = term;
      bestScore = score;
    }
  }
  return bestTerm;
}

function hasPanoramaActionTerm(text: string, id: PanoramaActionTermId) {
  const term = PANORAMA_ACTION_TERMS.find((item) => item.id === id);
  return Boolean(term && scorePanoramaActionTerm(text, term) > 0);
}

function actionTermAvatarPatch(term: PanoramaActionTerm | null): Partial<PanoramaActionPlanAvatar> {
  if (!term?.avatarPatch) return {};
  const poseId = term.avatarPatch.poseId || term.poseId;
  const poseRoot = poseId ? panoramaAvatarPoseRootDefaults(poseId) : {};
  const poseParams = poseId ? panoramaAvatarPoseDefaultParams(poseId) : undefined;
  return {
    ...poseRoot,
    ...term.avatarPatch,
    poseParams: cleanPanoramaActionPoseParams(mergePanoramaActionPoseParams(poseParams, term.avatarPatch.poseParams)),
  };
}

function planAvatarFromRaw(raw: unknown, index: number): PanoramaActionPlanAvatar {
  const item = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const poseId = item.poseId === undefined ? undefined : safePanoramaAvatarPose(item.poseId);
  const poseRoot = poseId ? panoramaAvatarPoseRootDefaults(poseId) : undefined;
  const poseParams = mergePanoramaActionPoseParams(
    poseId ? panoramaAvatarPoseDefaultParams(poseId) : undefined,
    cleanPanoramaActionPoseParams(item.poseParams),
  );
  return {
    ref: cleanPanoramaActionRef(item.ref, `角色${index + 1}`),
    name: cleanPanoramaActionText(item.name, 18) || undefined,
    color: cleanPanoramaColor(item.color, PANORAMA_AVATAR_COLORS[index % PANORAMA_AVATAR_COLORS.length]),
    visible: item.visible === undefined ? undefined : item.visible !== false,
    yaw: item.yaw === undefined ? undefined : normalizePanoramaYaw(item.yaw),
    pitch: item.pitch === undefined ? undefined : clampPanoramaNumber(item.pitch, -80, 45, -18),
    distance: item.distance === undefined ? undefined : clampPanoramaNumber(item.distance, 80, 420, 220),
    heightOffset: item.heightOffset === undefined ? undefined : clampPanoramaNumber(item.heightOffset, -80, 120, 0),
    rootHeight: item.rootHeight === undefined ? poseRoot?.rootHeight : clampPanoramaNumber(item.rootHeight, -80, 180, 0),
    rootPitch: item.rootPitch === undefined ? poseRoot?.rootPitch : clampPanoramaNumber(item.rootPitch, -90, 90, 0),
    rootRoll: item.rootRoll === undefined ? poseRoot?.rootRoll : clampPanoramaNumber(item.rootRoll, -120, 120, 0),
    groundMode: item.groundMode === undefined ? poseRoot?.groundMode : safePanoramaAvatarGroundMode(item.groundMode),
    scale: item.scale === undefined ? undefined : clampPanoramaNumber(item.scale, 0.35, 2.6, 1),
    heading: item.heading === undefined ? undefined : normalizePanoramaYaw(item.heading),
    faceMode: item.faceMode === undefined ? undefined : safePanoramaAvatarFaceMode(item.faceMode),
    poseId,
    poseParams,
    opacity: item.opacity === undefined ? undefined : clampPanoramaNumber(item.opacity, 0.15, 1, 0.9),
    characterPrompt: cleanPanoramaActionText(item.characterPrompt, 160) || undefined,
    roleText: cleanPanoramaActionText(item.roleText, 80) || undefined,
    confidence: item.confidence === undefined ? undefined : clampPanoramaNumber(item.confidence, 0, 1, 0.7),
  };
}

function planKeyframeFromRaw(raw: unknown, index: number): PanoramaActionPlanKeyframe | null {
  const item = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const avatarRef = cleanPanoramaActionRef(item.avatarRef, '');
  if (!avatarRef) return null;
  const poseId = item.poseId === undefined ? undefined : safePanoramaAvatarPose(item.poseId);
  const poseRoot = poseId ? panoramaAvatarPoseRootDefaults(poseId) : undefined;
  const poseParams = mergePanoramaActionPoseParams(
    poseId ? panoramaAvatarPoseDefaultParams(poseId) : undefined,
    cleanPanoramaActionPoseParams(item.poseParams),
  );
  return {
    avatarRef,
    label: cleanPanoramaActionText(item.label, 18) || `K${index + 1}`,
    time: Math.round(clampPanoramaNumber(item.time, 0, 30, index) * 10) / 10,
    yaw: item.yaw === undefined ? undefined : normalizePanoramaYaw(item.yaw),
    pitch: item.pitch === undefined ? undefined : clampPanoramaNumber(item.pitch, -80, 45, -18),
    distance: item.distance === undefined ? undefined : clampPanoramaNumber(item.distance, 80, 420, 220),
    heightOffset: item.heightOffset === undefined ? undefined : clampPanoramaNumber(item.heightOffset, -80, 120, 0),
    rootHeight: item.rootHeight === undefined ? poseRoot?.rootHeight : clampPanoramaNumber(item.rootHeight, -80, 180, 0),
    rootPitch: item.rootPitch === undefined ? poseRoot?.rootPitch : clampPanoramaNumber(item.rootPitch, -90, 90, 0),
    rootRoll: item.rootRoll === undefined ? poseRoot?.rootRoll : clampPanoramaNumber(item.rootRoll, -120, 120, 0),
    groundMode: item.groundMode === undefined ? poseRoot?.groundMode : safePanoramaAvatarGroundMode(item.groundMode),
    scale: item.scale === undefined ? undefined : clampPanoramaNumber(item.scale, 0.35, 2.6, 1),
    heading: item.heading === undefined ? undefined : normalizePanoramaYaw(item.heading),
    faceMode: item.faceMode === undefined ? undefined : safePanoramaAvatarFaceMode(item.faceMode),
    poseId,
    poseParams,
    note: cleanPanoramaActionText(item.note, 140) || undefined,
  };
}

function enrichPanoramaActionKeyframePose(
  frame: PanoramaActionPlanKeyframe,
  poseIdValue: unknown,
): PanoramaActionPlanKeyframe {
  const poseId = safePanoramaAvatarPose(poseIdValue);
  const root = panoramaAvatarPoseRootDefaults(poseId);
  return {
    ...frame,
    poseId,
    rootHeight: frame.rootHeight ?? root.rootHeight,
    rootPitch: frame.rootPitch ?? root.rootPitch,
    rootRoll: frame.rootRoll ?? root.rootRoll,
    groundMode: frame.groundMode ?? root.groundMode,
    poseParams: mergePanoramaActionPoseParams(panoramaAvatarPoseDefaultParams(poseId), frame.poseParams),
  };
}

function normalizePanoramaActionKeyframes(
  keyframes: PanoramaActionPlanKeyframe[],
  avatars: PanoramaActionPlanAvatar[],
  duration?: number,
) {
  if (keyframes.length === 0) return keyframes;
  const avatarPoseByRef = new Map<string, PanoramaAvatarPoseId>();
  avatars.forEach((avatar) => {
    if (avatar.poseId) {
      avatarPoseByRef.set(avatar.ref, avatar.poseId);
      if (avatar.name) avatarPoseByRef.set(avatar.name, avatar.poseId);
    }
  });
  const next = keyframes.map((frame) => (
    enrichPanoramaActionKeyframePose(frame, frame.poseId || avatarPoseByRef.get(frame.avatarRef) || 'standing')
  ));
  const groups = new Map<string, number[]>();
  next.forEach((frame, index) => {
    const indices = groups.get(frame.avatarRef) || [];
    indices.push(index);
    groups.set(frame.avatarRef, indices);
  });
  groups.forEach((indices) => {
    if (indices.length <= 1) return;
    const frames = indices.map((index) => next[index]);
    const duplicateTimes = new Set(frames.map((frame) => frame.time)).size !== frames.length;
    const nonIncreasing = frames.some((frame, order) => order > 0 && frame.time <= frames[order - 1].time);
    const tooLong = Math.max(...frames.map((frame) => frame.time)) - Math.min(...frames.map((frame) => frame.time)) > Math.max(1, indices.length - 1) * 6;
    if (duplicateTimes || nonIncreasing || tooLong) {
      const step = Math.max(0.4, Math.min(1.2, (duration || indices.length - 1) / Math.max(1, indices.length - 1)));
      indices.forEach((index, order) => {
        next[index] = { ...next[index], time: Math.round(order * step * 10) / 10 };
      });
    }
    const signatures = indices.map((index) => {
      const frame = next[index];
      return `${frame.poseId || ''}:${JSON.stringify(frame.poseParams || {})}`;
    });
    const allStatic = new Set(signatures).size === 1;
    if (!allStatic) return;
    const lastIndex = indices[indices.length - 1];
    const finalPose = safePanoramaAvatarPose(next[lastIndex].poseId || avatarPoseByRef.get(next[lastIndex].avatarRef) || 'standing');
    let startPose = panoramaAvatarPoseStartPose(finalPose);
    if (startPose === finalPose && finalPose !== 'standing') startPose = 'standing';
    if (startPose === finalPose) return;
    const firstIndex = indices[0];
    next[firstIndex] = enrichPanoramaActionKeyframePose({
      ...next[firstIndex],
      poseId: startPose,
      note: next[firstIndex].note || '起始姿势，避免动作序列静止',
    }, startPose);
    next[lastIndex] = enrichPanoramaActionKeyframePose({
      ...next[lastIndex],
      poseId: finalPose,
      note: next[lastIndex].note || '动作结果姿势',
    }, finalPose);
  });
  return next;
}

function maxPanoramaSequenceFramesForKeyframes(keyframes: PanoramaActionPlanKeyframe[]) {
  if (keyframes.length <= 1) return PANORAMA_KEYFRAME_SEQUENCE_MAX;
  const groups = new Map<string, number>();
  keyframes.forEach((frame) => groups.set(frame.avatarRef, (groups.get(frame.avatarRef) || 0) + 1));
  const maxSegments = Math.max(1, ...Array.from(groups.values()).map((count) => Math.max(1, count - 1)));
  return Math.max(2, Math.min(PANORAMA_KEYFRAME_SEQUENCE_MAX, maxSegments * 6));
}

export function sanitizePanoramaActionPlan(value: unknown): PanoramaActionPlan {
  const rawRoot = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const raw = rawRoot.plan && typeof rawRoot.plan === 'object' && !Array.isArray(rawRoot.plan)
    ? rawRoot.plan as Record<string, unknown>
    : rawRoot;
  const mode: PanoramaActionPlanMode =
    raw.mode === 'replace-actors' || raw.mode === 'update-selected' ? raw.mode : 'append';
  const avatars = (Array.isArray(raw.avatars) ? raw.avatars : [])
    .map((item, index) => planAvatarFromRaw(item, index))
    .filter((item) => item.ref)
    .slice(0, PANORAMA_AVATAR_LIMIT);
  const rawKeyframes = (Array.isArray(raw.keyframes) ? raw.keyframes : [])
    .map((item, index) => planKeyframeFromRaw(item, index))
    .filter((item): item is PanoramaActionPlanKeyframe => Boolean(item))
    .slice(0, PANORAMA_AVATAR_KEYFRAME_LIMIT);
  const duration = raw.duration === undefined ? undefined : Math.round(clampPanoramaNumber(raw.duration, 0.2, 30, 1) * 10) / 10;
  const keyframes = normalizePanoramaActionKeyframes(rawKeyframes, avatars, duration);
  const sequenceFrameCount = raw.sequenceFrameCount === undefined
    ? undefined
    : Math.min(
        sanitizePanoramaSequenceFrameCount(raw.sequenceFrameCount),
        maxPanoramaSequenceFramesForKeyframes(keyframes),
      );
  const rawShot = raw.shotCamera && typeof raw.shotCamera === 'object' && !Array.isArray(raw.shotCamera)
    ? raw.shotCamera as Record<string, unknown>
    : null;
  const shotCamera = rawShot
    ? {
        ...sanitizePanoramaShotCamera(rawShot),
        targetAvatarRef: cleanPanoramaActionText(rawShot.targetAvatarRef, 24) || undefined,
      }
    : undefined;
  return {
    schema: PANORAMA_ACTION_PLAN_SCHEMA,
    version: 1,
    mode,
    prompt: cleanPanoramaActionText(raw.prompt, 800),
    duration,
    sequenceFrameCount,
    avatars,
    keyframes: keyframes.length ? keyframes : undefined,
    shotCamera,
    occlusionMasks: Array.isArray(raw.occlusionMasks)
      ? sanitizePanoramaOcclusionMasks(raw.occlusionMasks, PANORAMA_OCCLUSION_MASK_LIMIT)
      : undefined,
    notes: cleanPanoramaActionNotes(raw.notes),
    warnings: cleanPanoramaActionNotes(raw.warnings),
  };
}

function inferPlanSequenceFrameCount(text: string) {
  const match = text.match(/(?:生成|输出|做成|按)?\s*(\d{1,2})\s*(?:帧|frame|frames)/i);
  return match ? sanitizePanoramaSequenceFrameCount(match[1]) : undefined;
}

function inferPlanDuration(text: string) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:秒|s\b|sec|seconds?)/i);
  return match ? Math.round(clampPanoramaNumber(match[1], 0.2, 30, 1) * 10) / 10 : undefined;
}

function makePlanRoleRefs(text: string) {
  const refs = extractPanoramaActionRoleRefs(text);
  if (refs.length) return refs;
  const hasTwoRoleCue = /双人|两人|对打|打斗|攻击|受击|踢|扶|追逐|击中|combat|fight|kick|hit/i.test(text);
  return hasTwoRoleCue ? ['角色A', '角色B'] : ['当前角色'];
}

function chooseFallbackRoleTerm(text: string, index: number, total: number) {
  const hasKick = hasPanoramaActionTerm(text, 'flying-kick');
  const hasHit = hasPanoramaActionTerm(text, 'hit-back');
  const hasHelp = hasPanoramaActionTerm(text, 'help-up');
  const hasDodge = hasPanoramaActionTerm(text, 'dodge');
  if (total >= 2) {
    if (hasHelp) return index === 0 ? inferPanoramaActionTerm('扶起', 'relation') : inferPanoramaActionTerm('跪地', 'pose');
    if (hasKick && hasHit) return index === 0 ? inferPanoramaActionTerm('飞踢', 'relation') : inferPanoramaActionTerm('受击', 'relation');
    if (hasKick) return index === 0 ? inferPanoramaActionTerm('飞踢', 'relation') : inferPanoramaActionTerm('战斗', 'pose');
    if (hasHit) return index === 0 ? inferPanoramaActionTerm('受击', 'relation') : inferPanoramaActionTerm('战斗', 'pose');
    if (hasDodge) return index === 0 ? inferPanoramaActionTerm('战斗', 'pose') : inferPanoramaActionTerm('闪避', 'relation');
  }
  return inferPanoramaActionTerm(text, 'relation') || inferPanoramaActionTerm(text, 'pose') || inferPanoramaActionTerm('站立', 'pose');
}

export function buildPanoramaLocalActionPlan(params: {
  prompt?: unknown;
  view?: Partial<PanoramaViewAngles>;
  avatars?: unknown;
  activeAvatarId?: unknown;
  mode?: PanoramaActionPlanMode;
}): PanoramaActionPlan {
  const prompt = cleanPanoramaActionText(params.prompt, 1000);
  const view = sanitizePanoramaViewAngles(params.view || {});
  const refs = makePlanRoleRefs(prompt).slice(0, PANORAMA_AVATAR_LIMIT);
  const existing = sanitizePanoramaAvatars(params.avatars);
  const basePitch = clampPanoramaNumber(view.pitch - 10, -50, 25, -12);
  const duration = inferPlanDuration(prompt) ?? (/关键帧|序列|开始|然后|最后|到|from|to/i.test(prompt) ? 1 : undefined);
  const requestedSequenceFrameCount = inferPlanSequenceFrameCount(prompt);
  const shotTerm = inferPanoramaActionTerm(prompt, 'shot');
  const planAvatars = refs.map((ref, index) => {
    const segment = roleSegmentText(prompt, ref);
    const term =
      inferPanoramaActionTerm(segment, 'relation') ||
      inferPanoramaActionTerm(segment, 'pose') ||
      chooseFallbackRoleTerm(prompt, index, refs.length);
    const existingAvatar = existing[index];
    const spacing = refs.length > 1 ? (index - (refs.length - 1) / 2) * 14 : 0;
    const yaw = normalizePanoramaYaw(view.yaw + spacing);
    const patch = actionTermAvatarPatch(term);
    return planAvatarFromRaw({
      ref,
      name: ref === '当前角色'
        ? existingAvatar?.name || '当前角色'
        : ref,
      color: PANORAMA_AVATAR_COLORS[index % PANORAMA_AVATAR_COLORS.length],
      visible: true,
      yaw,
      pitch: basePitch,
      distance: 220,
      heightOffset: 0,
      scale: refs.length > 1 ? 0.95 : 1,
      heading: yaw,
      faceMode: refs.length > 1 ? 'heading' : 'camera',
      opacity: 0.9,
      roleText: segment || term?.label || '',
      confidence: term ? 0.82 : 0.58,
      ...patch,
      poseParams: mergePanoramaActionPoseParams(patch.poseParams),
    }, index);
  });
  if (planAvatars.length >= 2) {
    const attackerIndex = planAvatars.findIndex((item) => item.poseId === 'flying-kick' || item.poseId === 'combat' || item.poseId === 'running');
    const victimIndex = planAvatars.findIndex((item) => item.poseId === 'hit-back' || item.poseId === 'kneel' || item.poseId === 'lying' || item.poseId === 'crouch');
    if (attackerIndex >= 0 && victimIndex >= 0 && attackerIndex !== victimIndex) {
      planAvatars[attackerIndex].yaw = normalizePanoramaYaw(view.yaw + 8);
      planAvatars[victimIndex].yaw = normalizePanoramaYaw(view.yaw - 7);
    }
    planAvatars.forEach((avatar, index) => {
      const other = planAvatars[index === 0 ? 1 : 0];
      if (other?.yaw !== undefined) avatar.heading = normalizePanoramaYaw(other.yaw);
      avatar.faceMode = 'heading';
    });
  }
  const shouldKeyframe = Boolean(
    duration ||
    requestedSequenceFrameCount ||
    planAvatars.some((item) => item.poseId && panoramaAvatarPoseIsDynamic(item.poseId)),
  );
  const keyframes = shouldKeyframe
    ? planAvatars.flatMap((avatar, avatarIndex) => {
        const finalPose = avatar.poseId || 'standing';
        const startPose = panoramaAvatarPoseStartPose(finalPose);
        const startRoot = panoramaAvatarPoseRootDefaults(startPose);
        return [
          planKeyframeFromRaw({
            avatarRef: avatar.ref,
            label: `K${avatarIndex + 1}-1`,
            time: 0,
            poseId: startPose,
            groundMode: startRoot.groundMode,
            rootHeight: startRoot.rootHeight,
            rootPitch: startRoot.rootPitch,
            rootRoll: startRoot.rootRoll,
            yaw: avatar.yaw,
            pitch: avatar.pitch,
            distance: avatar.distance,
            heightOffset: avatar.heightOffset,
            scale: avatar.scale,
            heading: avatar.heading,
            faceMode: avatar.faceMode,
            poseParams: panoramaAvatarPoseDefaultParams(startPose),
            note: '起始姿势',
          }, avatarIndex * 2),
          planKeyframeFromRaw({
            avatarRef: avatar.ref,
            label: `K${avatarIndex + 1}-2`,
            time: duration ?? 1,
            poseId: finalPose,
            yaw: avatar.yaw,
            pitch: avatar.pitch,
            distance: avatar.distance,
            heightOffset: avatar.heightOffset,
            rootHeight: avatar.rootHeight,
            rootPitch: avatar.rootPitch,
            rootRoll: avatar.rootRoll,
            groundMode: avatar.groundMode,
            scale: avatar.scale,
            heading: avatar.heading,
            faceMode: avatar.faceMode,
            poseParams: avatar.poseParams,
            note: '动作结果姿势',
          }, avatarIndex * 2 + 1),
        ].filter((item): item is PanoramaActionPlanKeyframe => Boolean(item));
      })
    : undefined;
  const inferredSequenceFrameCount = shouldKeyframe
    ? Math.min(requestedSequenceFrameCount || 6, keyframes ? maxPanoramaSequenceFramesForKeyframes(keyframes) : PANORAMA_KEYFRAME_SEQUENCE_MAX)
    : requestedSequenceFrameCount;
  const shotPreset = shotTerm?.shotPresetId
    ? PANORAMA_SHOT_PRESETS.find((item) => item.id === shotTerm.shotPresetId)
    : undefined;
  const shotTargetRef = (() => {
    if (!shotTerm) return '';
    if (shotTerm.id === 'victim-pov') {
      return planAvatars.find((item) => item.poseId === 'hit-back')?.ref || planAvatars[0]?.ref || '';
    }
    if (shotTerm.id === 'foot-closeup') {
      return planAvatars.find((item) => item.poseId === 'flying-kick')?.ref || planAvatars[0]?.ref || '';
    }
    return planAvatars.find((item) => item.poseId === 'flying-kick')?.ref || planAvatars[0]?.ref || '';
  })();
  return sanitizePanoramaActionPlan({
    schema: PANORAMA_ACTION_PLAN_SCHEMA,
    version: 1,
    mode: params.mode || (cleanPanoramaActionText(params.activeAvatarId, 48) ? 'update-selected' : 'append'),
    prompt,
    duration,
    sequenceFrameCount: inferredSequenceFrameCount,
    avatars: planAvatars,
    keyframes,
    shotCamera: shotTerm && shotPreset
      ? {
          mode: 'shot-camera',
          presetId: shotPreset.id,
          targetAvatarRef: shotTargetRef,
          targetBone: shotTerm.targetBone || shotPreset.targetBone,
          framingRatio: shotPreset.framingRatio,
          closeupStrength: shotPreset.closeupStrength,
          lowAngle: shotPreset.lowAngle,
        }
      : undefined,
    notes: [
      '本地规则解析生成，可继续在画面拖动关节和遮挡微调。',
      shotTerm ? `已识别镜头：${shotTerm.label}` : '',
    ].filter(Boolean),
    warnings: prompt ? [] : ['请输入动作导演指令。'],
  });
}

export function extractPanoramaActionPlanJson(value: unknown): unknown | null {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  const candidates: string[] = [];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.push(fence[1].trim());
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  candidates.push(text);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

export function parsePanoramaActionPlanJson(value: unknown): PanoramaActionPlan | null {
  const parsed = extractPanoramaActionPlanJson(value);
  if (!parsed) return null;
  return sanitizePanoramaActionPlan(parsed);
}

export function buildPanoramaActionPlannerSystemPrompt() {
  const poses = PANORAMA_AVATAR_POSES.map((pose) => `${pose.id}:${pose.label}`).join(', ');
  const shots = PANORAMA_SHOT_PRESETS.map((shot) => `${shot.id}:${shot.label}`).join(', ');
  const bones = PANORAMA_SHOT_TARGET_BONES.map((bone) => bone.id).join(', ');
  return [
    '你是 T8 3D 全景动作导演台的结构化规划器。只输出 JSON，不要 Markdown，不要解释。',
    `schema 必须是 "${PANORAMA_ACTION_PLAN_SCHEMA}"，version 必须是 1。`,
    '你的任务是把用户的自然语言动作导演指令转换为可编辑的低模角色、关键帧和导演镜头草案。',
    '不要声称单张全景有真实 x/y/z 空间视差；yaw/pitch/distance 只是全景画面里的构图参考。',
    `可用 poseId: ${poses}`,
    `可用 shotCamera.presetId: ${shots}`,
    `可用 shotCamera.targetBone: ${bones}`,
    'JSON 顶层字段: schema, version, mode, prompt, duration, sequenceFrameCount, avatars, keyframes, shotCamera, occlusionMasks, notes, warnings。',
    'avatars 每项至少包含 ref 和 poseId；keyframes 使用 avatarRef 关联 avatars.ref；shotCamera 可用 targetAvatarRef 指向角色。',
    '优先选择最贴近的 poseId，例如跆拳道要使用 taekwondo-roundhouse / taekwondo-front-kick / taekwondo-side-kick / taekwondo-axe-kick / taekwondo-back-kick，不要退回 standing 或泛泛 combat。',
    '如果动作库没有完全匹配的动作，可以选择最接近的 poseId，并用 poseParams 自定义四肢；poseParams 可用 armLZ/armRZ/legLZ/legRZ、armLBendZ/armRBendZ/legLBendZ/legRBendZ 等数值。',
    '同一角色的相邻关键帧必须有可见变化；不要输出 K1/K2/K3 全部相同 poseId 且没有 poseParams 差异。',
    '序列帧要克制：每个动作段最多 6 帧；2 个关键帧最多 6 帧，3 个关键帧最多 12 帧，除非有更多明确阶段不要输出 48 帧。',
    '数值保持保守: yaw -180..180, pitch -80..45, distance 80..420, scale 0.35..2.6, rootPitch -90..90, rootRoll -120..120。',
  ].join('\n');
}

export function buildPanoramaActionPlannerUserPrompt(params: {
  prompt?: unknown;
  view?: Partial<PanoramaViewAngles>;
  avatars?: unknown;
  activeAvatarId?: unknown;
}) {
  const prompt = cleanPanoramaActionText(params.prompt, 1000);
  const view = sanitizePanoramaViewAngles(params.view || {});
  const avatars = sanitizePanoramaAvatars(params.avatars).slice(0, PANORAMA_AVATAR_LIMIT);
  const activeId = cleanPanoramaActionText(params.activeAvatarId, 48);
  const avatarLines = avatars.map((avatar, index) => (
    `${index + 1}. id=${avatar.id}, name=${avatar.name}, pose=${avatar.poseId}, yaw=${avatar.yaw}, pitch=${avatar.pitch}, color=${avatar.color}${avatar.id === activeId ? ', active=true' : ''}`
  ));
  return [
    `用户动作导演指令：${prompt || '(空)'}`,
    `当前视角：yaw=${view.yaw}, pitch=${view.pitch}, fov=${view.fov}`,
    avatarLines.length ? `已有角色：\n${avatarLines.join('\n')}` : '已有角色：无',
    '请返回一个完整 JSON 动作草案。若用户没有指定角色，优先生成当前角色；若包含双人关系，可生成角色A/角色B。',
  ].join('\n');
}

export function normalizePanoramaYaw(value: unknown) {
  const n = clampPanoramaNumber(value, -99999, 99999, 0);
  const wrapped = ((n + 180) % 360 + 360) % 360 - 180;
  return Object.is(wrapped, -0) ? 0 : Math.round(wrapped * 100) / 100;
}

export function sanitizePanoramaViewAngles(value: Partial<PanoramaViewAngles> = {}): PanoramaViewAngles {
  return {
    yaw: normalizePanoramaYaw(value.yaw),
    pitch: clampPanoramaNumber(value.pitch, -85, 85, 0),
    fov: clampPanoramaNumber(value.fov, 35, 100, 75),
  };
}

export function sanitizePanoramaCameraViews(value: unknown, maxItems = PANORAMA_CAMERA_VIEW_LIMIT): PanoramaCameraView[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .filter((item): item is Record<string, any> => !!item && typeof item === 'object')
    .map((item, index) => {
      const angles = sanitizePanoramaViewAngles(item);
      return {
        id: cleanPanoramaText(item.id, 48) || `view_${index + 1}`,
        name: cleanPanoramaName(item.name, `机位 ${index + 1}`),
        ...angles,
        isDefault: Boolean(item.isDefault),
        snapshotUrl: cleanPanoramaText(item.snapshotUrl, 500),
        createdAt: cleanPanoramaText(item.createdAt, 40) || new Date(0).toISOString(),
      };
    })
    .slice(0, Math.max(1, maxItems))
    .map((item, index, arr) => ({
      ...item,
      isDefault: item.isDefault && arr.findIndex((entry) => entry.isDefault) === index,
    }));
}

export function upsertPanoramaCameraView(
  current: unknown,
  view: Partial<PanoramaCameraView> & Partial<PanoramaViewAngles>,
  maxItems = PANORAMA_CAMERA_VIEW_LIMIT,
): PanoramaCameraView[] {
  const list = sanitizePanoramaCameraViews(current, maxItems);
  const id = cleanPanoramaText(view.id, 48) || makePanoramaId('view');
  const angles = sanitizePanoramaViewAngles(view);
  const item: PanoramaCameraView = {
    id,
    name: cleanPanoramaName(view.name, `机位 ${Math.min(list.length + 1, maxItems)}`),
    ...angles,
    isDefault: Boolean(view.isDefault),
    snapshotUrl: cleanPanoramaText(view.snapshotUrl, 500),
    createdAt: cleanPanoramaText(view.createdAt, 40) || new Date().toISOString(),
  };
  const next = [item, ...list.filter((entry) => entry.id !== id)].slice(0, Math.max(1, maxItems));
  return item.isDefault ? markPanoramaDefaultCameraView(next, item.id) : next;
}

export function markPanoramaDefaultCameraView(current: unknown, id: string): PanoramaCameraView[] {
  const target = cleanPanoramaText(id, 48);
  return sanitizePanoramaCameraViews(current).map((item) => ({
    ...item,
    isDefault: Boolean(target && item.id === target),
  }));
}

export function deletePanoramaCameraView(current: unknown, id: string): PanoramaCameraView[] {
  const target = cleanPanoramaText(id, 48);
  return sanitizePanoramaCameraViews(current).filter((item) => item.id !== target);
}

export function sanitizePanoramaHotspots(value: unknown, maxItems = PANORAMA_HOTSPOT_LIMIT): PanoramaHotspot[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .filter((item): item is Record<string, any> => !!item && typeof item === 'object')
    .map((item, index) => {
      const angles = sanitizePanoramaViewAngles(item);
      const targetAngles = sanitizePanoramaViewAngles({
        yaw: item.targetYaw ?? angles.yaw,
        pitch: item.targetPitch ?? angles.pitch,
        fov: item.targetFov ?? angles.fov,
      });
      return {
        id: cleanPanoramaText(item.id, 48) || `hotspot_${index + 1}`,
        label: cleanPanoramaName(item.label, `热点 ${index + 1}`),
        yaw: angles.yaw,
        pitch: angles.pitch,
        fov: angles.fov,
        targetNodeId: cleanPanoramaText(item.targetNodeId, 80),
        targetYaw: targetAngles.yaw,
        targetPitch: targetAngles.pitch,
        targetFov: targetAngles.fov,
        createdAt: cleanPanoramaText(item.createdAt, 40) || new Date(0).toISOString(),
      };
    })
    .slice(0, Math.max(1, maxItems));
}

export function upsertPanoramaHotspot(
  current: unknown,
  hotspot: Partial<PanoramaHotspot> & Partial<PanoramaViewAngles>,
  maxItems = PANORAMA_HOTSPOT_LIMIT,
): PanoramaHotspot[] {
  const list = sanitizePanoramaHotspots(current, maxItems);
  const id = cleanPanoramaText(hotspot.id, 48) || makePanoramaId('hotspot');
  const angles = sanitizePanoramaViewAngles(hotspot);
  const targetAngles = sanitizePanoramaViewAngles({
    yaw: hotspot.targetYaw ?? hotspot.yaw,
    pitch: hotspot.targetPitch ?? hotspot.pitch,
    fov: hotspot.targetFov ?? hotspot.fov,
  });
  const item: PanoramaHotspot = {
    id,
    label: cleanPanoramaName(hotspot.label, `热点 ${Math.min(list.length + 1, maxItems)}`),
    yaw: angles.yaw,
    pitch: angles.pitch,
    fov: angles.fov,
    targetNodeId: cleanPanoramaText(hotspot.targetNodeId, 80),
    targetYaw: targetAngles.yaw,
    targetPitch: targetAngles.pitch,
    targetFov: targetAngles.fov,
    createdAt: cleanPanoramaText(hotspot.createdAt, 40) || new Date().toISOString(),
  };
  return [item, ...list.filter((entry) => entry.id !== id)].slice(0, Math.max(1, maxItems));
}

export function deletePanoramaHotspot(current: unknown, id: string): PanoramaHotspot[] {
  const target = cleanPanoramaText(id, 48);
  return sanitizePanoramaHotspots(current).filter((item) => item.id !== target);
}

export function updatePanoramaHotspot(current: unknown, id: string, patch: Partial<PanoramaHotspot>): PanoramaHotspot[] {
  const target = cleanPanoramaText(id, 48);
  return sanitizePanoramaHotspots(current).map((item) => (
    item.id === target
      ? sanitizePanoramaHotspots([{ ...item, ...patch }], 1)[0]
      : item
  ));
}

function cleanPoseParams(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, number | string | boolean> = {};
  Object.entries(value as Record<string, unknown>).slice(0, 24).forEach(([key, raw]) => {
    const cleanKey = cleanPanoramaText(key, 40);
    if (!cleanKey) return;
    if (typeof raw === 'boolean') out[cleanKey] = raw;
    else if (typeof raw === 'number' && Number.isFinite(raw)) out[cleanKey] = Math.round(raw * 1000) / 1000;
    else if (typeof raw === 'string') out[cleanKey] = cleanPanoramaText(raw, 80);
  });
  return Object.keys(out).length ? out : undefined;
}

export function sanitizePanoramaAvatars(value: unknown, maxItems = PANORAMA_AVATAR_LIMIT): PanoramaAvatar[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .filter((item): item is Record<string, any> => !!item && typeof item === 'object')
    .map((item, index) => {
      const fallbackColor = PANORAMA_AVATAR_COLORS[index % PANORAMA_AVATAR_COLORS.length];
      return {
        id: cleanPanoramaText(item.id, 48) || `avatar_${index + 1}`,
        name: cleanPanoramaName(item.name, `角色 ${index + 1}`),
        visible: item.visible !== false,
        yaw: normalizePanoramaYaw(item.yaw),
        pitch: clampPanoramaNumber(item.pitch, -80, 45, -18),
        distance: clampPanoramaNumber(item.distance, 80, 420, 220),
        heightOffset: clampPanoramaNumber(item.heightOffset, -80, 120, 0),
        rootHeight: clampPanoramaNumber(item.rootHeight, -40, 180, 0),
        rootPitch: clampPanoramaNumber(item.rootPitch, -90, 90, 0),
        rootRoll: clampPanoramaNumber(item.rootRoll, -120, 120, 0),
        groundMode: safePanoramaAvatarGroundMode(item.groundMode),
        scale: clampPanoramaNumber(item.scale, 0.35, 2.6, 1),
        heading: normalizePanoramaYaw(item.heading),
        faceMode: safePanoramaAvatarFaceMode(item.faceMode),
        poseId: safePanoramaAvatarPose(item.poseId),
        poseParams: cleanPoseParams(item.poseParams),
        color: cleanPanoramaColor(item.color, fallbackColor),
        opacity: clampPanoramaNumber(item.opacity, 0.15, 1, 0.9),
        locked: Boolean(item.locked),
        characterPrompt: cleanPanoramaText(item.characterPrompt, 180),
        createdAt: cleanPanoramaText(item.createdAt, 40) || new Date(0).toISOString(),
      };
    })
    .slice(0, Math.max(1, maxItems));
}

export function upsertPanoramaAvatar(
  current: unknown,
  avatar: Partial<PanoramaAvatar>,
  maxItems = PANORAMA_AVATAR_LIMIT,
): PanoramaAvatar[] {
  const list = sanitizePanoramaAvatars(current, maxItems);
  const id = cleanPanoramaText(avatar.id, 48) || makePanoramaId('avatar');
  const fallbackColor = PANORAMA_AVATAR_COLORS[list.length % PANORAMA_AVATAR_COLORS.length];
  const item = sanitizePanoramaAvatars([{
    id,
    name: avatar.name || `角色 ${Math.min(list.length + 1, maxItems)}`,
    visible: avatar.visible,
    yaw: avatar.yaw,
    pitch: avatar.pitch,
    distance: avatar.distance,
    heightOffset: avatar.heightOffset,
    rootHeight: avatar.rootHeight,
    rootPitch: avatar.rootPitch,
    rootRoll: avatar.rootRoll,
    groundMode: avatar.groundMode,
    scale: avatar.scale,
    heading: avatar.heading,
    faceMode: avatar.faceMode,
    poseId: avatar.poseId,
    poseParams: avatar.poseParams,
    color: avatar.color || fallbackColor,
    opacity: avatar.opacity,
    locked: avatar.locked,
    characterPrompt: avatar.characterPrompt,
    createdAt: avatar.createdAt || new Date().toISOString(),
  }], 1)[0];
  return [item, ...list.filter((entry) => entry.id !== id)].slice(0, Math.max(1, maxItems));
}

export function updatePanoramaAvatar(current: unknown, id: string, patch: Partial<PanoramaAvatar>): PanoramaAvatar[] {
  const target = cleanPanoramaText(id, 48);
  return sanitizePanoramaAvatars(current).map((item) => (
    item.id === target
      ? sanitizePanoramaAvatars([{ ...item, ...patch }], 1)[0]
      : item
  ));
}

export function deletePanoramaAvatar(current: unknown, id: string): PanoramaAvatar[] {
  const target = cleanPanoramaText(id, 48);
  return sanitizePanoramaAvatars(current).filter((item) => item.id !== target);
}

function avatarKeyframeFromRaw(
  raw: Record<string, any>,
  index: number,
  avatars: PanoramaAvatar[],
): PanoramaAvatarKeyframe {
  const avatarId = cleanPanoramaText(raw.avatarId || raw.id, 48);
  const linkedAvatar = avatars.find((item) => item.id === avatarId);
  const poseId = safePanoramaAvatarPose(raw.poseId || linkedAvatar?.poseId);
  return {
    id: cleanPanoramaText(raw.id, 48) || `keyframe_${index + 1}`,
    label: cleanPanoramaName(raw.label, `关键帧 ${index + 1}`),
    avatarId: avatarId || linkedAvatar?.id || '',
    avatarName: cleanPanoramaName(raw.avatarName || linkedAvatar?.name, linkedAvatar?.name || `角色 ${index + 1}`),
    time: Math.round(clampPanoramaNumber(raw.time, 0, 20, index) * 10) / 10,
    yaw: normalizePanoramaYaw(raw.yaw ?? linkedAvatar?.yaw),
    pitch: clampPanoramaNumber(raw.pitch ?? linkedAvatar?.pitch, -80, 45, -18),
    distance: clampPanoramaNumber(raw.distance ?? linkedAvatar?.distance, 80, 420, 220),
    heightOffset: clampPanoramaNumber(raw.heightOffset ?? linkedAvatar?.heightOffset, -80, 120, 0),
    rootHeight: clampPanoramaNumber(raw.rootHeight ?? linkedAvatar?.rootHeight, -40, 180, 0),
    rootPitch: clampPanoramaNumber(raw.rootPitch ?? linkedAvatar?.rootPitch, -90, 90, 0),
    rootRoll: clampPanoramaNumber(raw.rootRoll ?? linkedAvatar?.rootRoll, -120, 120, 0),
    groundMode: safePanoramaAvatarGroundMode(raw.groundMode ?? linkedAvatar?.groundMode),
    scale: clampPanoramaNumber(raw.scale ?? linkedAvatar?.scale, 0.35, 2.6, 1),
    heading: normalizePanoramaYaw(raw.heading ?? linkedAvatar?.heading),
    faceMode: safePanoramaAvatarFaceMode(raw.faceMode ?? linkedAvatar?.faceMode),
    poseId,
    poseParams: cleanPoseParams(raw.poseParams ?? linkedAvatar?.poseParams),
    note: cleanPanoramaText(raw.note, 160),
    createdAt: cleanPanoramaText(raw.createdAt, 40) || new Date(0).toISOString(),
  };
}

export function sanitizePanoramaAvatarKeyframes(
  value: unknown,
  avatarsValue: unknown = [],
  maxItems = PANORAMA_AVATAR_KEYFRAME_LIMIT,
): PanoramaAvatarKeyframe[] {
  const avatars = sanitizePanoramaAvatars(avatarsValue);
  const list = Array.isArray(value) ? value : [];
  return list
    .filter((item): item is Record<string, any> => !!item && typeof item === 'object')
    .map((item, index) => avatarKeyframeFromRaw(item, index, avatars))
    .slice(0, Math.max(1, maxItems))
    .sort((a, b) => a.time - b.time || a.label.localeCompare(b.label));
}

export function upsertPanoramaAvatarKeyframe(
  current: unknown,
  keyframe: Partial<PanoramaAvatarKeyframe> & Partial<PanoramaAvatar>,
  avatarsValue: unknown = [],
  maxItems = PANORAMA_AVATAR_KEYFRAME_LIMIT,
): PanoramaAvatarKeyframe[] {
  const list = sanitizePanoramaAvatarKeyframes(current, avatarsValue, maxItems);
  const rawId = cleanPanoramaText(keyframe.id, 48);
  const avatarId = cleanPanoramaText(keyframe.avatarId, 48);
  const id = rawId && rawId !== avatarId ? rawId : makePanoramaId('keyframe');
  const item = sanitizePanoramaAvatarKeyframes([{
    ...keyframe,
    id,
    avatarId,
    avatarName: keyframe.avatarName || keyframe.name,
    createdAt: keyframe.createdAt || new Date().toISOString(),
  }], avatarsValue, 1)[0];
  return [item, ...list.filter((entry) => entry.id !== id)]
    .slice(0, Math.max(1, maxItems))
    .sort((a, b) => a.time - b.time || a.label.localeCompare(b.label));
}

export function deletePanoramaAvatarKeyframe(current: unknown, id: string, avatarsValue: unknown = []): PanoramaAvatarKeyframe[] {
  const target = cleanPanoramaText(id, 48);
  return sanitizePanoramaAvatarKeyframes(current, avatarsValue).filter((item) => item.id !== target);
}

export function sanitizePanoramaSequenceFrameCount(value: unknown) {
  return Math.round(clampPanoramaNumber(value, 2, PANORAMA_KEYFRAME_SEQUENCE_MAX, PANORAMA_KEYFRAME_SEQUENCE_DEFAULT));
}

function lerpPanoramaNumber(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpPanoramaYaw(a: number, b: number, t: number) {
  return normalizePanoramaYaw(a + angleDelta(b, a) * t);
}

function lerpPoseParams(
  a: Record<string, number | string | boolean> | undefined,
  b: Record<string, number | string | boolean> | undefined,
  t: number,
) {
  const out: Record<string, number | string | boolean> = {};
  const keys = Array.from(new Set([...Object.keys(a || {}), ...Object.keys(b || {})]));
  keys.forEach((key) => {
    const av = a?.[key];
    const bv = b?.[key];
    if (typeof av === 'number' && typeof bv === 'number') {
      out[key] = Math.round(lerpPanoramaNumber(av, bv, t) * 1000) / 1000;
    } else if (bv !== undefined && t >= 0.5) {
      out[key] = bv;
    } else if (av !== undefined) {
      out[key] = av;
    }
  });
  return out;
}

function interpolateKeyframe(
  a: PanoramaAvatarKeyframe,
  b: PanoramaAvatarKeyframe,
  t: number,
  frameIndex: number,
  avatarIndex: number,
): PanoramaAvatarKeyframe {
  const poseSource = t < 0.5 ? a : b;
  const time = lerpPanoramaNumber(a.time, b.time, t);
  return {
    ...poseSource,
    id: `sequence_${frameIndex + 1}_${avatarIndex + 1}_${a.avatarId}`,
    label: `F${String(frameIndex + 1).padStart(2, '0')}`,
    time: Math.round(time * 10) / 10,
    yaw: lerpPanoramaYaw(a.yaw, b.yaw, t),
    pitch: Math.round(lerpPanoramaNumber(a.pitch, b.pitch, t) * 10) / 10,
    distance: Math.round(lerpPanoramaNumber(a.distance, b.distance, t) * 10) / 10,
    heightOffset: Math.round(lerpPanoramaNumber(a.heightOffset, b.heightOffset, t) * 10) / 10,
    rootHeight: Math.round(lerpPanoramaNumber(a.rootHeight, b.rootHeight, t) * 10) / 10,
    rootPitch: Math.round(lerpPanoramaNumber(a.rootPitch, b.rootPitch, t) * 10) / 10,
    rootRoll: Math.round(lerpPanoramaNumber(a.rootRoll, b.rootRoll, t) * 10) / 10,
    scale: Math.round(lerpPanoramaNumber(a.scale, b.scale, t) * 100) / 100,
    heading: lerpPanoramaYaw(a.heading, b.heading, t),
    faceMode: t < 0.5 ? a.faceMode : b.faceMode,
    groundMode: t < 0.5 ? a.groundMode : b.groundMode,
    poseId: poseSource.poseId,
    poseParams: lerpPoseParams(a.poseParams, b.poseParams, t),
    note: poseSource.note,
    createdAt: poseSource.createdAt,
  };
}

function keyframeToSnapshotFrame(
  frame: PanoramaAvatarKeyframe,
  view: PanoramaViewAngles,
  aspect: number,
): PanoramaSceneSnapshotKeyframe {
  return {
    ...frame,
    poseLabel: panoramaAvatarPoseLabel(frame.poseId),
    posePrompt: panoramaAvatarPosePrompt(frame.poseId),
    screen: projectPanoramaAvatar({ avatar: frame as unknown as PanoramaAvatar, view, aspect }),
  };
}

export function buildPanoramaAvatarSequenceFrames(params: {
  keyframes?: unknown;
  avatars?: unknown;
  view: PanoramaViewAngles;
  width?: unknown;
  height?: unknown;
  frameCount?: unknown;
  imageUrls?: unknown;
}): PanoramaSceneSnapshotSequenceFrame[] {
  const avatars = sanitizePanoramaAvatars(params.avatars);
  const keyframes = sanitizePanoramaAvatarKeyframes(params.keyframes, avatars);
  const frameCount = sanitizePanoramaSequenceFrameCount(params.frameCount);
  if (keyframes.length < 2) return [];
  const byAvatar = new Map<string, PanoramaAvatarKeyframe[]>();
  keyframes.forEach((frame) => {
    if (!frame.avatarId) return;
    const list = byAvatar.get(frame.avatarId) || [];
    list.push(frame);
    byAvatar.set(frame.avatarId, list);
  });
  const tracks = Array.from(byAvatar.values())
    .map((track) => track.sort((a, b) => a.time - b.time))
    .filter((track) => track.length >= 2);
  if (tracks.length === 0) return [];
  const view = sanitizePanoramaViewAngles(params.view);
  const aspect = (Number(params.width) || 16) / Math.max(1, Number(params.height) || 9);
  const imageUrls = Array.isArray(params.imageUrls)
    ? params.imageUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
    : [];
  const minTime = Math.min(...tracks.map((track) => track[0].time));
  const maxTime = Math.max(...tracks.map((track) => track[track.length - 1].time));
  return Array.from({ length: frameCount }, (_, frameIndex) => {
    const tGlobal = frameCount <= 1 ? 0 : frameIndex / (frameCount - 1);
    const time = minTime + (maxTime - minTime) * tGlobal;
    const avatarsForFrame = tracks.map((track, avatarIndex) => {
      let left = track[0];
      let right = track[track.length - 1];
      for (let i = 0; i < track.length - 1; i++) {
        if (time >= track[i].time && time <= track[i + 1].time) {
          left = track[i];
          right = track[i + 1];
          break;
        }
      }
      const span = Math.max(0.001, right.time - left.time);
      const localT = Math.max(0, Math.min(1, (time - left.time) / span));
      return keyframeToSnapshotFrame(interpolateKeyframe(left, right, localT, frameIndex, avatarIndex), view, aspect);
    });
    return {
      id: `sequence_frame_${frameIndex + 1}`,
      frameIndex: frameIndex + 1,
      frameLabel: `F${String(frameIndex + 1).padStart(2, '0')}`,
      time: Math.round(time * 10) / 10,
      avatars: avatarsForFrame,
      imageUrl: imageUrls[frameIndex],
    };
  });
}

export function sanitizePanoramaOcclusionMasks(
  value: unknown,
  maxItems = PANORAMA_OCCLUSION_MASK_LIMIT,
): PanoramaOcclusionMask[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .filter((item): item is Record<string, any> => !!item && typeof item === 'object')
    .map((item, index) => ({
      id: cleanPanoramaText(item.id, 48) || `mask_${index + 1}`,
      label: cleanPanoramaName(item.label, `遮挡 ${index + 1}`),
      x: clampPanoramaNumber(item.x, 0, 100, 35),
      y: clampPanoramaNumber(item.y, 0, 100, 55),
      w: clampPanoramaNumber(item.w, 4, 100, 30),
      h: clampPanoramaNumber(item.h, 4, 100, 16),
      strength: clampPanoramaNumber(item.strength, 0, 100, 70),
      note: cleanPanoramaText(item.note, 180),
      createdAt: cleanPanoramaText(item.createdAt, 40) || new Date(0).toISOString(),
    }))
    .slice(0, Math.max(1, maxItems));
}

export function upsertPanoramaOcclusionMask(
  current: unknown,
  mask: Partial<PanoramaOcclusionMask>,
  maxItems = PANORAMA_OCCLUSION_MASK_LIMIT,
): PanoramaOcclusionMask[] {
  const list = sanitizePanoramaOcclusionMasks(current, maxItems);
  const id = cleanPanoramaText(mask.id, 48) || makePanoramaId('mask');
  const item = sanitizePanoramaOcclusionMasks([{
    ...mask,
    id,
    createdAt: mask.createdAt || new Date().toISOString(),
  }], 1)[0];
  return [item, ...list.filter((entry) => entry.id !== id)].slice(0, Math.max(1, maxItems));
}

export function deletePanoramaOcclusionMask(current: unknown, id: string): PanoramaOcclusionMask[] {
  const target = cleanPanoramaText(id, 48);
  return sanitizePanoramaOcclusionMasks(current).filter((item) => item.id !== target);
}

function angleDelta(target: number, current: number) {
  return normalizePanoramaYaw(target - current);
}

export function projectPanoramaHotspot(params: {
  hotspot: Pick<PanoramaHotspot, 'yaw' | 'pitch'>;
  view: PanoramaViewAngles;
  aspect?: number;
}) {
  const aspect = Math.max(0.25, Number(params.aspect) || 16 / 9);
  const view = sanitizePanoramaViewAngles(params.view);
  const dx = angleDelta(params.hotspot.yaw, view.yaw);
  const dy = clampPanoramaNumber(params.hotspot.pitch, -85, 85, 0) - view.pitch;
  const horizontalFov = Math.max(35, Math.min(170, view.fov * aspect));
  const verticalFov = view.fov;
  if (Math.abs(dx) > horizontalFov / 2 || Math.abs(dy) > verticalFov / 2) {
    return { visible: false as const, x: 50, y: 50 };
  }
  return {
    visible: true as const,
    x: 50 + (dx / horizontalFov) * 100,
    y: 50 - (dy / verticalFov) * 100,
  };
}

export function projectPanoramaAvatar(params: {
  avatar: Pick<PanoramaAvatar, 'yaw' | 'pitch' | 'visible'>;
  view: PanoramaViewAngles;
  aspect?: number;
}) {
  if (params.avatar.visible === false) return { visible: false as const, x: 50, y: 50 };
  const pos = projectPanoramaHotspot({
    hotspot: { yaw: params.avatar.yaw, pitch: params.avatar.pitch },
    view: params.view,
    aspect: params.aspect,
  });
  return pos;
}

function shotBoneLabel(id: PanoramaShotTargetBone) {
  return PANORAMA_SHOT_TARGET_BONES.find((item) => item.id === id)?.label || PANORAMA_SHOT_TARGET_BONES[0].label;
}

function shotPresetLabel(id: PanoramaShotPresetId) {
  return PANORAMA_SHOT_PRESETS.find((item) => item.id === id)?.label || PANORAMA_SHOT_PRESETS[0].label;
}

function shotPresetPrompt(id: PanoramaShotPresetId) {
  return PANORAMA_SHOT_PRESETS.find((item) => item.id === id)?.prompt || PANORAMA_SHOT_PRESETS[0].prompt;
}

function shotBoneOffset(
  bone: PanoramaShotTargetBone,
  avatar: Pick<PanoramaAvatar, 'scale'>,
) {
  const s = clampPanoramaNumber(avatar.scale, 0.35, 2.6, 1);
  const offsets: Record<PanoramaShotTargetBone, { x: number; y: number }> = {
    body: { x: 0, y: 0 },
    head: { x: 0, y: -13 },
    torso: { x: 0, y: -4 },
    pelvis: { x: 0, y: 7 },
    leftHand: { x: -8, y: -2 },
    rightHand: { x: 8, y: -2 },
    leftFoot: { x: -4, y: 15 },
    rightFoot: { x: 4, y: 15 },
  };
  const offset = offsets[bone] || offsets.body;
  return { x: offset.x * s, y: offset.y * s };
}

export function projectPanoramaShotTarget(params: {
  shotCamera: unknown;
  avatars: unknown;
  view: PanoramaViewAngles;
  aspect?: number;
}) {
  const shotCamera = sanitizePanoramaShotCamera(params.shotCamera);
  const avatars = sanitizePanoramaAvatars(params.avatars).filter((item) => item.visible);
  const target =
    avatars.find((item) => item.id === shotCamera.targetAvatarId) ||
    avatars[0];
  if (!target) return { visible: false as const, x: 50, y: 50, label: shotBoneLabel(shotCamera.targetBone) };
  const base = projectPanoramaAvatar({ avatar: target, view: params.view, aspect: params.aspect });
  if (!base.visible) return { visible: false as const, x: base.x, y: base.y, label: `${target.name} · ${shotBoneLabel(shotCamera.targetBone)}` };
  const offset = shotBoneOffset(shotCamera.targetBone, target);
  return {
    visible: true as const,
    x: clampPanoramaNumber(base.x + offset.x, -10, 110, 50),
    y: clampPanoramaNumber(base.y + offset.y, -10, 110, 50),
    label: `${target.name} · ${shotBoneLabel(shotCamera.targetBone)}`,
  };
}

export function screenPointToPanoramaAngles(params: {
  xRatio: number;
  yRatio: number;
  view: PanoramaViewAngles;
  aspect?: number;
}) {
  const aspect = Math.max(0.25, Number(params.aspect) || 16 / 9);
  const view = sanitizePanoramaViewAngles(params.view);
  const horizontalFov = Math.max(35, Math.min(170, view.fov * aspect));
  const x = clampPanoramaNumber(params.xRatio, 0, 1, 0.5) - 0.5;
  const y = clampPanoramaNumber(params.yRatio, 0, 1, 0.5) - 0.5;
  return sanitizePanoramaViewAngles({
    yaw: view.yaw + x * horizontalFov,
    pitch: view.pitch - y * view.fov,
    fov: view.fov,
  });
}

function avatarDirectionLabel(avatar: Pick<PanoramaAvatar, 'yaw'>, view: PanoramaViewAngles) {
  const dx = angleDelta(avatar.yaw, view.yaw);
  if (Math.abs(dx) <= 12) return '画面中央';
  if (dx < -55) return '画面左侧边缘';
  if (dx < -18) return '画面左侧';
  if (dx > 55) return '画面右侧边缘';
  if (dx > 18) return '画面右侧';
  return dx < 0 ? '画面中央偏左' : '画面中央偏右';
}

function avatarDepthLabel(distance: number) {
  if (distance < 150) return '近景';
  if (distance > 320) return '远景';
  return '中景';
}

function avatarFacingLabel(avatar: Pick<PanoramaAvatar, 'faceMode' | 'heading'>, view: PanoramaViewAngles) {
  if (avatar.faceMode === 'camera') return '面向镜头';
  const dx = Math.abs(angleDelta(avatar.heading, view.yaw));
  if (dx < 35) return '大致面向镜头方向';
  if (dx > 145) return '背对镜头方向';
  return '侧向镜头方向';
}

function avatarRootMotionLabel(avatar: Pick<PanoramaAvatar, 'groundMode' | 'rootHeight' | 'rootPitch' | 'rootRoll'>) {
  const parts: string[] = [];
  if (avatar.groundMode === 'grounded') {
    parts.push('脚底贴地');
  } else if (avatar.rootHeight > 18) {
    parts.push(`整体离地约${Math.round(avatar.rootHeight)}单位`);
  } else if (avatar.groundMode === 'floating') {
    parts.push('悬空姿态');
  } else {
    parts.push('手动高度姿态');
  }
  if (Math.abs(avatar.rootPitch) >= 8) {
    parts.push(avatar.rootPitch > 0 ? `身体后仰${Math.round(avatar.rootPitch)}度` : `身体前倾${Math.round(Math.abs(avatar.rootPitch))}度`);
  }
  if (Math.abs(avatar.rootRoll) >= 8) {
    parts.push(avatar.rootRoll > 0 ? `身体向右翻滚${Math.round(avatar.rootRoll)}度` : `身体向左翻滚${Math.round(Math.abs(avatar.rootRoll))}度`);
  }
  return parts.join('，');
}

export function buildPanoramaShotCameraPrompt(params: {
  shotCamera?: unknown;
  avatars?: unknown;
  view?: PanoramaViewAngles;
}) {
  const shotCamera = sanitizePanoramaShotCamera(params.shotCamera);
  if (shotCamera.mode !== 'shot-camera') return '';
  const avatars = sanitizePanoramaAvatars(params.avatars).filter((item) => item.visible);
  const target =
    avatars.find((item) => item.id === shotCamera.targetAvatarId) ||
    avatars[0];
  const targetName = target?.name || '当前角色';
  const boneLabel = shotBoneLabel(shotCamera.targetBone);
  const presetLabel = shotPresetLabel(shotCamera.presetId);
  const presetPrompt = shotPresetPrompt(shotCamera.presetId);
  const closeup = Math.round(shotCamera.closeupStrength);
  const lowAngle = Math.round(shotCamera.lowAngle);
  const ratio = shotCamera.framingRatio === 'off' ? '16:9' : shotCamera.framingRatio;
  return [
    `导演镜头参考：${presetLabel}，镜头目标锁定「${targetName}」的${boneLabel}，构图比例 ${ratio}。`,
    `镜头语言：${presetPrompt}; close-up strength ${closeup}/100; low camera angle ${lowAngle}/100.`,
    '该镜头是动作参考取景框，不代表单张全景内存在真实平移视差；请保持背景全景关系，同时让目标身体部位成为画面主体。',
  ].join('\n');
}

function screenRegionLabel(mask: PanoramaOcclusionMask) {
  const cx = mask.x + mask.w / 2;
  const cy = mask.y + mask.h / 2;
  const horizontal = cx < 34 ? '左侧' : cx > 66 ? '右侧' : '中央';
  const vertical = cy < 34 ? '上方' : cy > 66 ? '下方' : '中部';
  return `${vertical}${horizontal}`;
}

export function buildPanoramaKeyframePrompt(params: {
  keyframes?: unknown;
  avatars?: unknown;
  sequenceFrameCount?: unknown;
}) {
  const avatars = sanitizePanoramaAvatars(params.avatars);
  const keyframes = sanitizePanoramaAvatarKeyframes(params.keyframes, avatars);
  if (keyframes.length === 0) return '';
  const frameCount = sanitizePanoramaSequenceFrameCount(params.sequenceFrameCount);
  const lines = keyframes.map((frame) => {
    const avatar = avatars.find((item) => item.id === frame.avatarId);
    const avatarName = avatar?.name || frame.avatarName || '角色';
    const root = avatarRootMotionLabel(frame);
    const note = frame.note ? `；备注：${frame.note}` : '';
    return `${frame.label} ${frame.time.toFixed(1)}s：${avatarName}，动作 ${panoramaAvatarPoseLabel(frame.poseId)}，${panoramaAvatarPosePrompt(frame.poseId)}，${root}${note}`;
  });
  return [
    '动作时间轴参考：',
    ...lines,
    `请把这些关键帧理解为起始/结束/中间姿势，并按 ${frameCount} 帧动作序列平滑过渡，保持角色位置、身体倾斜和动作连续性。`,
  ].join('\n');
}

export function buildPanoramaOcclusionPrompt(params: {
  occlusionMasks?: unknown;
}) {
  const masks = sanitizePanoramaOcclusionMasks(params.occlusionMasks);
  if (masks.length === 0) return '';
  const lines = masks.map((mask, index) => {
    const note = mask.note ? `，说明：${mask.note}` : '';
    return `${index + 1}. 「${mask.label}」位于画面${screenRegionLabel(mask)}，范围约 ${Math.round(mask.w)}%×${Math.round(mask.h)}%，遮挡强度 ${Math.round(mask.strength)}/100${note}`;
  });
  return [
    '遮挡参考：',
    ...lines,
    '这些区域是人工标注的前景遮挡 / 接触边界参考，不代表全景图有真实深度；生成时请按画面关系处理人物前后层次。',
  ].join('\n');
}

export function buildPanoramaScenePrompt(params: {
  avatars: unknown;
  view: PanoramaViewAngles;
  shotCamera?: unknown;
  keyframes?: unknown;
  sequenceFrameCount?: unknown;
  occlusionMasks?: unknown;
}) {
  const avatars = sanitizePanoramaAvatars(params.avatars).filter((item) => item.visible);
  const view = sanitizePanoramaViewAngles(params.view);
  const lines = avatars.map((avatar, index) => {
    const prefix = `${index + 1}. ${avatar.color} 角色「${avatar.name}」`;
    const pose = panoramaAvatarPosePrompt(avatar.poseId);
    const character = avatar.characterPrompt ? `角色设定：${avatar.characterPrompt}；` : '';
    const root = avatarRootMotionLabel(avatar);
    return `${prefix}位于${avatarDirectionLabel(avatar, view)}的${avatarDepthLabel(avatar.distance)}，${avatarFacingLabel(avatar, view)}，动作：${pose}；Root状态：${root}；${character}请保持该角色的相对位置、朝向、大小、离地高度、身体倾斜和动作关系。`;
  });
  const shotPrompt = buildPanoramaShotCameraPrompt({ shotCamera: params.shotCamera, avatars, view });
  const keyframePrompt = buildPanoramaKeyframePrompt({ keyframes: params.keyframes, avatars, sequenceFrameCount: params.sequenceFrameCount });
  const occlusionPrompt = buildPanoramaOcclusionPrompt({ occlusionMasks: params.occlusionMasks });
  if (avatars.length === 0 && !shotPrompt && !keyframePrompt && !occlusionPrompt) return '';
  return [
    avatars.length ? `全景人物布局参考：\n${lines.join('\n')}` : '',
    shotPrompt,
    keyframePrompt,
    occlusionPrompt,
  ].filter(Boolean).join('\n\n');
}

export function buildPanoramaSceneSnapshot(params: {
  sourceUrl?: unknown;
  promptFinal?: unknown;
  view: PanoramaViewAngles;
  ratioId?: unknown;
  width?: unknown;
  height?: unknown;
  avatars: unknown;
  compositionGuide?: unknown;
  shotCamera?: unknown;
  keyframes?: unknown;
  sequenceFrameCount?: unknown;
  sequenceFrameUrls?: unknown;
  occlusionMasks?: unknown;
  snapshotUrl?: unknown;
  controlSnapshotUrl?: unknown;
  createdAt?: unknown;
}): PanoramaSceneSnapshot {
  const view = sanitizePanoramaViewAngles(params.view);
  const avatars = sanitizePanoramaAvatars(params.avatars).filter((item) => item.visible);
  const aspect = (Number(params.width) || 16) / Math.max(1, Number(params.height) || 9);
  const shotCamera = sanitizePanoramaShotCamera(params.shotCamera);
  const shotTarget = projectPanoramaShotTarget({ shotCamera, avatars, view, aspect });
  const keyframes = sanitizePanoramaAvatarKeyframes(params.keyframes, avatars);
  const sequenceFrameCount = sanitizePanoramaSequenceFrameCount(params.sequenceFrameCount);
  const occlusionMasks = sanitizePanoramaOcclusionMasks(params.occlusionMasks);
  const snapshotAvatars: PanoramaSceneSnapshotAvatar[] = avatars.map((avatar) => ({
    id: avatar.id,
    name: avatar.name,
    color: avatar.color,
    yaw: avatar.yaw,
    pitch: avatar.pitch,
    distance: avatar.distance,
    heightOffset: avatar.heightOffset,
    rootHeight: avatar.rootHeight,
    rootPitch: avatar.rootPitch,
    rootRoll: avatar.rootRoll,
    groundMode: avatar.groundMode,
    scale: avatar.scale,
    heading: avatar.heading,
    faceMode: avatar.faceMode,
    poseId: avatar.poseId,
    poseLabel: panoramaAvatarPoseLabel(avatar.poseId),
    posePrompt: panoramaAvatarPosePrompt(avatar.poseId),
    characterPrompt: avatar.characterPrompt || undefined,
    screen: projectPanoramaAvatar({ avatar, view, aspect }),
  }));
  const snapshotKeyframes: PanoramaSceneSnapshotKeyframe[] = keyframes.map((frame) => {
    return {
      ...frame,
      poseLabel: panoramaAvatarPoseLabel(frame.poseId),
      posePrompt: panoramaAvatarPosePrompt(frame.poseId),
      screen: projectPanoramaAvatar({ avatar: { ...frame, visible: true }, view, aspect }),
    };
  });
  const sequenceFrames = buildPanoramaAvatarSequenceFrames({
    keyframes,
    avatars,
    view,
    width: params.width,
    height: params.height,
    frameCount: sequenceFrameCount,
    imageUrls: params.sequenceFrameUrls,
  });
  return {
    schema: 't8-panorama-scene-snapshot',
    version: 1,
    background: {
      sourceUrl: cleanPanoramaText(params.sourceUrl, 500),
      promptFinal: cleanPanoramaText(params.promptFinal, 3000),
      yaw: view.yaw,
      pitch: view.pitch,
      fov: view.fov,
      ratio: cleanPanoramaText(params.ratioId, 24) || 'wide',
      width: Math.max(1, Math.round(Number(params.width) || 0)),
      height: Math.max(1, Math.round(Number(params.height) || 0)),
    },
    avatars: snapshotAvatars,
    keyframes: snapshotKeyframes,
    sequenceFrameCount,
    sequenceFrames,
    occlusionMasks,
    compositionGuide: safePanoramaCompositionGuide(params.compositionGuide),
    shotCamera,
    shotTarget,
    promptText: buildPanoramaScenePrompt({ avatars, view, shotCamera, keyframes, sequenceFrameCount, occlusionMasks }),
    snapshotUrl: cleanPanoramaText(params.snapshotUrl, 500),
    controlSnapshotUrl: cleanPanoramaText(params.controlSnapshotUrl, 500),
    createdAt: cleanPanoramaText(params.createdAt, 40) || new Date().toISOString(),
  };
}

export function prependPanoramaHistory(
  current: unknown,
  item: PanoramaGenerationHistoryItem,
  maxItems = 3,
): PanoramaGenerationHistoryItem[] {
  const list = Array.isArray(current) ? current : [];
  return [
    item,
    ...list
      .filter((entry): entry is PanoramaGenerationHistoryItem => {
        return !!entry && typeof entry === 'object' && typeof (entry as any).url === 'string';
      })
      .filter((entry) => entry.url !== item.url),
  ].slice(0, Math.max(1, maxItems));
}

export function clampPanoramaNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function resolvePanoramaRatio(id: unknown, customW: unknown, customH: unknown): PanoramaRatio {
  const key = typeof id === 'string' ? id : 'wide';
  if (key !== 'custom' && Object.prototype.hasOwnProperty.call(PANORAMA_RATIO_PRESETS, key)) {
    return PANORAMA_RATIO_PRESETS[key as Exclude<PanoramaRatioId, 'custom'>];
  }
  return {
    w: clampPanoramaNumber(customW, 1, 999, 16),
    h: clampPanoramaNumber(customH, 1, 999, 9),
  };
}

export function panoramaRenderSize(ratio: PanoramaRatio, longSide = 1536) {
  const safeW = Math.max(1, Number(ratio.w) || 16);
  const safeH = Math.max(1, Number(ratio.h) || 9);
  const aspect = safeW / safeH;
  if (aspect >= 1) {
    return { width: longSide, height: Math.max(1, Math.round(longSide / aspect)) };
  }
  return { width: Math.max(1, Math.round(longSide * aspect)), height: longSide };
}

export function classifyPanoramaSeamScore(score: number | null): Pick<PanoramaImageQuality, 'level' | 'seamLabel' | 'hint'> {
  if (score == null || !Number.isFinite(score)) {
    return { level: 'unknown', seamLabel: '无法检测', hint: '当前图片无法读取像素，可能是跨域图片或浏览器安全限制。' };
  }
  if (score >= 90) return { level: 'excellent', seamLabel: '接缝优秀', hint: '左右边缘像素差异很小，适合继续预览或入库。' };
  if (score >= 76) return { level: 'good', seamLabel: '接缝可用', hint: '左右边缘有轻微差异，建议旋转检查主体边缘。' };
  return { level: 'warning', seamLabel: '可能有缝', hint: '左右边缘差异较明显，建议重新生成或补充“边缘无缝衔接”。' };
}

function panoramaAspectLabel(width: number, height: number) {
  const aspect = width / Math.max(1, height);
  if (aspect >= 2.25 && aspect <= 2.45) return '21:9';
  if (aspect >= 1.9 && aspect <= 2.1) return '2:1';
  return `非标准 ${aspect.toFixed(2)}:1`;
}

export function estimatePanoramaImageQuality(image: HTMLImageElement): PanoramaImageQuality {
  const width = Math.max(0, image.naturalWidth || image.width || 0);
  const height = Math.max(0, image.naturalHeight || image.height || 0);
  const unknown = classifyPanoramaSeamScore(null);
  if (!width || !height || typeof document === 'undefined') {
    return {
      ...unknown,
      seamScore: null,
      aspectLabel: width && height ? panoramaAspectLabel(width, height) : '未知比例',
      width,
      height,
    };
  }
  try {
    const sampleW = Math.max(64, Math.min(384, Math.round(width)));
    const sampleH = Math.max(32, Math.min(192, Math.round(height)));
    const strip = Math.max(4, Math.min(12, Math.round(sampleW * 0.025)));
    const canvas = document.createElement('canvas');
    canvas.width = sampleW;
    canvas.height = sampleH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('canvas context unavailable');
    ctx.drawImage(image, 0, 0, sampleW, sampleH);
    const left = ctx.getImageData(0, 0, strip, sampleH).data;
    const right = ctx.getImageData(sampleW - strip, 0, strip, sampleH).data;
    let diff = 0;
    let count = 0;
    for (let i = 0; i < left.length; i += 4) {
      diff += Math.abs(left[i] - right[i]) + Math.abs(left[i + 1] - right[i + 1]) + Math.abs(left[i + 2] - right[i + 2]);
      count += 3;
    }
    const normalized = count > 0 ? diff / (count * 255) : 1;
    const score = Math.max(0, Math.min(100, Math.round((1 - normalized) * 100)));
    const classified = classifyPanoramaSeamScore(score);
    const aspectLabel = panoramaAspectLabel(width, height);
    return {
      ...classified,
      seamScore: score,
      aspectLabel,
      width,
      height,
      hint: aspectLabel.startsWith('非标准')
        ? `${classified.hint} 当前不是常见 2:1 或 21:9 全景比例，预览可能出现拉伸。`
        : classified.hint,
    };
  } catch {
    return {
      ...unknown,
      seamScore: null,
      aspectLabel: panoramaAspectLabel(width, height),
      width,
      height,
    };
  }
}

export function isLikelyPanoramaImage(meta: {
  url?: string;
  label?: string;
  title?: string;
  prompt?: string;
  width?: number;
  height?: number;
}) {
  const text = [meta.url, meta.label, meta.title, meta.prompt].filter(Boolean).join(' ');
  if (/(?:360|720|全景|环景|panorama|equirect|spherical|vr\b)/i.test(text)) return true;
  const w = Number(meta.width || 0);
  const h = Number(meta.height || 0);
  if (!(w > 0 && h > 0)) return false;
  const aspect = w / h;
  return aspect >= 1.9 && aspect <= 2.1;
}
