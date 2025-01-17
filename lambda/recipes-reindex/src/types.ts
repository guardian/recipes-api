export type SharedStepFnState = {
	dryRun?: boolean; // If true or absent, do not send reindex messages.
};

export type SnapshotRecipeIndexInput = SharedStepFnState & {
	executionId: string;
};

export type SnapshotRecipeIndexOutput = SnapshotRecipeIndexInput & {
	nextIndex: number;
	indexObjectKey: string;
};

export type WriteBatchToReindexQueueInput = SnapshotRecipeIndexOutput;

export type WriteBatchToReindexQueueOutput = SnapshotRecipeIndexOutput & {
	lastIndex: number;
};

export type RecipeArticlesSnapshot = string[];
