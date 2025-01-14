export type SnapshotRecipeIndexInput = {
	executionId: string;
};

export type SnapshotRecipeIndexOutput = SnapshotRecipeIndexInput & {
	nextIndex: number;
	indexObjectKey: string;
};

export type WriteBatchToReindexQueueInput = {
	input: SnapshotRecipeIndexOutput;
	dryRun?: boolean;
};

export type WriteBatchToReindexQueueOutput = SnapshotRecipeIndexOutput & {
	lastIndex: number;
};

export type RecipeArticlesSnapshot = string[];
