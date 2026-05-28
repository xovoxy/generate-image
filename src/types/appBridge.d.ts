export {};

declare global {
  interface Window {
    appBridge: {
      version: string;
      getPathForFile: (file: File) => string;
      pathToFileUrl: (filePath: string) => string;
      getCozeConfigStatus: () => Promise<{
        hasApiToken: boolean;
        hasWorkflowId: boolean;
        isReady: boolean;
        taskConcurrency: number;
      }>;
      uploadCozeImages: (input: {
        imageAPath: string;
        imageBPath: string;
      }) => Promise<{
        image1Id: string;
        image2Id: string;
      }>;
      executeCozeWorkflow: (input: {
        taskId: string;
        type: number;
        image1Id: string;
        image2Id: string;
        prompt: string;
      }) => Promise<{
        resultImages: string[];
        raw: unknown;
      }>;
      runCozeTask: (input: {
        taskId: string;
        type: number;
        imageAPath: string;
        imageBPath: string;
        prompt: string;
      }) => Promise<{
        resultImages: string[];
        raw: unknown;
      }>;
      exportResults: (input: {
        tasks: { id: string; prompt: string; resultImages: string[] }[];
      }) => Promise<{
        exportedCount: number;
        outputDir?: string;
      }>;
      saveResultImage: (imagePath: string) => Promise<{
        saved: boolean;
        outputPath?: string;
      }>;
      getImageDataUrl: (filePath: string) => Promise<string>;
    };
  }
}
