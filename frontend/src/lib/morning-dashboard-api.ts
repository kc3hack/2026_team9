export type CalendarEvent = {
	title: string;
	location?: string | null;
	startTime: string;
};

export type MorningRoutineStep = {
	id: string;
	label: string;
	offsetMinutes: number;
	durationMinutes?: number;
	isOverride?: boolean;
};

export type MorningRoutineOverride = {
	date: string;
	steps: MorningRoutineStep[];
	note?: string;
};

export type MorningDashboard = {
	userId: string;
	date: string;
	earliestEvent: CalendarEvent | null;
	earliestEventJson?: string;
	wakeUpTime: string;
	departTime: string;
	createdAt: string;
	updatedAt: string;
	routine: MorningRoutineStep[];
	overrides?: MorningRoutineOverride[];
};
import mockDashboard from "../data/morning-dashboard.json";

export async function getMorningDashboard(
	date?: string,
): Promise<MorningDashboard> {
	if (!date || mockDashboard.date === date) {
		return mockDashboard as MorningDashboard;
	}

	return {
		...mockDashboard,
		date,
	} as MorningDashboard;
}
