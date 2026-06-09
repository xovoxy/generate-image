export type GenerateType = {
  type: number;
  key: string;
  name: string;
  description: string;
  imageCount: 1 | 2;
  enabled: boolean;
};

export const GENERATE_TYPES: GenerateType[] = [
  {
    type: 1,
    key: "object_consistency",
    name: "物体一致性",
    description: "保持主体物体一致，根据两张参考图和一句话生成新图",
    imageCount: 2,
    enabled: true
  },
  {
    type: 2,
    key: "image_to_image",
    name: "参考图生图",
    description: "根据一张参考图和一句话生成新图",
    imageCount: 1,
    enabled: true
  },
  {
    type: 3,
    key: "background_replacement",
    name: "背景置换",
    description: "根据两张参考图和一句话替换背景生成新图",
    imageCount: 2,
    enabled: true
  },
  {
    type: 4,
    key: "style_transfer",
    name: "风格转换",
    description: "根据一张参考图和一句话转换图片风格",
    imageCount: 1,
    enabled: true
  }
];

export function getEnabledGenerateTypes() {
  return GENERATE_TYPES.filter((item) => item.enabled);
}

export function getGenerateTypeByValue(type: number) {
  return GENERATE_TYPES.find((item) => item.type === type && item.enabled);
}
