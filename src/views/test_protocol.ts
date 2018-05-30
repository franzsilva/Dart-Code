export interface Notification {
	type: string;
}

export interface SuiteNotification extends Notification {
	suite: Suite;
}

export interface Suite {
	id: number;
	path: string;
}

export interface TestNotification extends Notification {
	test: Test;
}

export interface Item {
	id: number;
	name?: string;
}

export interface Test extends Item {
	groupId?: number;
}

export interface GroupNotification extends Notification {
	group: Group;
}

export interface Group extends Item {
	parentID?: number;
}

export interface TestStartNotification extends Notification {
	test: Test;
}
