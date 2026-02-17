export type TaskDecomposeRequest = {
	task: string;
	context?: string;
};

export type TaskDecomposeResult = {
	goal: string;
	subtasks: string[];
	assumptions: string[];
};
