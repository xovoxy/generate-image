export type GenerateType = {
  type: number;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
};

export const GENERATE_TYPES: GenerateType[] = [
  {
    type: 1,
    key: "object_consistency",
    name: "物体一致性",
    description: "保持主体物体一致，根据两张参考图和一句话生成新图",
    enabled: true
  },
  {
    type: 2,
    key: "person_consistency",
    name: "人物一致性",
    description: "保持人物身份一致，生成不同场景图",
    enabled: false
  }
];

export function getEnabledGenerateTypes() {
  return GENERATE_TYPES.filter((item) => item.enabled);
}

export function getGenerateTypeByValue(type: number) {
  return GENERATE_TYPES.find((item) => item.type === type && item.enabled);
}
