export type TaskDecomposeRequest = {
	task: string;
	context?: string;
	userId?: string;
};

export type TaskDecomposeResult = {
	goal: string;
	subtasks: string[];
	assumptions: string[];
};
