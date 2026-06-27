export interface StoryGraphAnalysis {
    issues: StoryGraphIssue[];
    labelReferences: StoryGraphLabelReference[];
    labelsByScene: Record<string, string[]>;
    reachableScenes: string[];
    sceneEdges: StoryGraphSceneEdge[];
    unreachableScenes: string[];
}

export type StoryGraphIssue =
    | {
        code: 'duplicate_label';
        label: string;
        message: string;
        path: number[];
        sceneName: string;
    }
    | {
        code: 'missing_label';
        label: string;
        message: string;
        path: number[];
        sceneName: string;
    }
    | {
        code: 'missing_scene';
        message: string;
        path: number[];
        sceneName: string;
        targetScene: string;
    }
    | {
        code: 'missing_start_scene';
        message: string;
        targetScene: string;
    }
    | {
        code: 'unreachable_scene';
        message: string;
        sceneName: string;
    };

export interface StoryGraphLabelReference {
    label: string;
    path: number[];
    sceneName: string;
}

export interface StoryGraphSceneEdge {
    fromScene: string;
    path: number[];
    targetScene: string;
    type: 'jump';
}
