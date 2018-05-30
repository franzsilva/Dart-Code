import * as _ from "lodash";
import * as path from "path";
import * as vs from "vscode";
import { extensionPath } from "../extension";
import { fsPath } from "../utils";
import { Group, GroupNotification, Suite, SuiteNotification, Test, TestDoneNotification, TestStartNotification } from "./test_protocol";

const DART_TEST_SUITE_NODE = "dart-code:testSuiteNode";
const DART_TEST_GROUP_NODE = "dart-code:testGroupNode";
const DART_TEST_TEST_NODE = "dart-code:testTestNode";

const suites: { [key: string]: SuiteData } = {};

export class TestResultsProvider implements vs.Disposable, vs.TreeDataProvider<object> {
	private disposables: vs.Disposable[] = [];
	private onDidChangeTreeDataEmitter: vs.EventEmitter<vs.TreeItem | undefined> = new vs.EventEmitter<vs.TreeItem | undefined>();
	public readonly onDidChangeTreeData: vs.Event<vs.TreeItem | undefined> = this.onDidChangeTreeDataEmitter.event;
	private onDidStartTestsEmitter: vs.EventEmitter<vs.TreeItem | undefined> = new vs.EventEmitter<vs.TreeItem | undefined>();
	public readonly onDidStartTests: vs.Event<vs.TreeItem | undefined> = this.onDidStartTestsEmitter.event;

	constructor() {
		// this.disposables.push(vs.debug.onDidReceiveDebugSessionCustomEvent((e) => {
		// 	if (e.event === "dart.testRunNotification") {
		// 		this.handleNotification(e.body.suitePath, e.body.notification);
		// 	}
		// }));
		// this.disposables.push(vs.commands.registerCommand("dart.startDebuggingTest", (treeNode: SuiteTreeItem | TestTreeItem) => {
		// 	vs.debug.startDebugging(
		// 		vs.workspace.getWorkspaceFolder(treeNode.resourceUri),
		// 		this.getLaunchConfig(false, treeNode),
		// 	);
		// }));
		// this.disposables.push(vs.commands.registerCommand("dart.startWithoutDebuggingTest", (treeNode: SuiteTreeItem | TestTreeItem) => {
		// 	vs.debug.startDebugging(
		// 		vs.workspace.getWorkspaceFolder(treeNode.resourceUri),
		// 		this.getLaunchConfig(true, treeNode),
		// 	);
		// }));

		setTimeout(() => this.sendFakeData(), 5000);
	}

	private sendFakeData() {
		const suitePath = "/Users/dantup/Dev/Google/flutter/examples/flutter_gallery/test/calculator/logic.dart";
		this.handleNotification(suitePath, { suite: { id: 0, platform: "vm", path: "/Users/dantup/Dev/Google/flutter/examples/flutter_gallery/test/calculator/logic.dart" }, type: "suite" });
		this.handleNotification(suitePath, { group: { id: 3, suiteID: 0, parentID: null, name: "GROUP 1" }, type: "group" });
		this.handleNotification(suitePath, { test: { id: 4, name: "TEST 1 (INSIDE GROUP 1)", suiteID: 0, groupIDs: [3] }, type: "testStart" });
		this.handleNotification(suitePath, { testID: 4, result: "success", skipped: false, hidden: false, type: "testDone" });
		this.handleNotification(suitePath, { test: { id: 5, name: "TEST 2 (NOT INSIDE GROUP)", suiteID: 0, groupIDs: [] }, type: "testStart" });
		this.handleNotification(suitePath, { testID: 5, result: "success", skipped: false, hidden: false, type: "testDone" });
	}

	private getLaunchConfig(noDebug: boolean, treeNode: SuiteTreeItem | TestTreeItem) {
		return {
			args: treeNode instanceof TestTreeItem ? ["--plain-name", treeNode.test.name] : undefined,
			name: "Tests",
			noDebug,
			program: fsPath(treeNode.resourceUri),
			request: "launch",
			type: "dart",
		};
	}

	public getTreeItem(element: vs.TreeItem): vs.TreeItem {
		return element;
	}

	public getChildren(element?: vs.TreeItem): vs.TreeItem[] {
		if (!element) {
			return _.flatMap(Object.keys(suites).map((k) => suites[k].suites));
		} else if (element instanceof SuiteTreeItem || element instanceof GroupTreeItem) {
			return element.children;
		}
	}

	public getParent?(element: vs.TreeItem): SuiteTreeItem | GroupTreeItem {
		if (element instanceof TestTreeItem || element instanceof GroupTreeItem)
			return element.parent;
	}

	private updateNode(node: SuiteTreeItem | GroupTreeItem | TestTreeItem): void {
		this.onDidChangeTreeDataEmitter.fire(node);
	}

	public dispose(): any {
		this.disposables.forEach((d) => d.dispose());
	}

	private handleNotification(suitePath: string, evt: any) {
		const suite = suites[suitePath];
		switch (evt.type) {
			case "suite":
				this.handleSuiteNotification(suitePath, evt as SuiteNotification);
				break;
			case "testStart":
				this.handleTestStartNotifcation(suite, evt as TestStartNotification);
				break;
			case "testDone":
				this.handleTestDoneNotification(suite, evt as TestDoneNotification);
				break;
			case "group":
				this.handleGroupNotification(suite, evt as GroupNotification);
				break;
		}
	}

	private handleSuiteNotification(suitePath: string, evt: SuiteNotification) {
		const suite = new SuiteData(suitePath, [new SuiteTreeItem(evt.suite)]);
		suites[evt.suite.path] = suite;
		this.onDidStartTestsEmitter.fire(suite.suites[evt.suite.id]);
		this.updateNode(suite.suites[evt.suite.id]);
		suite.suites[evt.suite.id].iconPath = getIconPath(TestStatus.Running);
	}

	private handleTestStartNotifcation(suite: SuiteData, evt: TestStartNotification) {
		const isExistingTest = !!suite.tests[evt.test.id];
		const testNode = suite.tests[evt.test.id] || new TestTreeItem(suite, evt.test);
		let oldParent: SuiteTreeItem | GroupTreeItem;

		if (!isExistingTest)
			suite.tests[evt.test.id] = testNode;
		else
			oldParent = testNode.parent;
		testNode.hidden = false;
		testNode.status = TestStatus.Running;
		testNode.test = evt.test;

		// Remove from old parent if required.
		if (oldParent && oldParent !== testNode.parent) {
			oldParent.tests.splice(oldParent.tests.indexOf(testNode), 1);
			this.updateNode(oldParent);
		}

		// Push to new parent if required.
		if (!isExistingTest)
			testNode.parent.tests.push(testNode);

		this.updateNode(testNode);
		this.updateNode(this.getParent(testNode));
	}

	private handleTestDoneNotification(suite: SuiteData, evt: TestDoneNotification) {
		const testNode = suite.tests[evt.testID];

		testNode.hidden = evt.hidden;
		if (evt.skipped) {
			testNode.status = TestStatus.Skipped;
		} else if (evt.result === "success") {
			testNode.status = TestStatus.Passed;
		} else if (evt.result === "failure") {
			testNode.status = TestStatus.Failed;
		} else if (evt.result === "error")
			testNode.status = TestStatus.Errored;
		else {
			testNode.status = TestStatus.Unknown;
		}

		this.updateNode(testNode);
		this.updateNode(this.getParent(testNode));
	}

	private handleGroupNotification(suite: SuiteData, evt: GroupNotification) {
		if (suite.groups[evt.group.id]) {
			const groupNode = suite.groups[evt.group.id];
			groupNode.group = evt.group;
			this.updateNode(groupNode);
			// TODO: Change parent if required...
		} else {
			const groupNode = new GroupTreeItem(suite, evt.group);
			suite.groups[evt.group.id] = groupNode;
			groupNode.parent.groups.push(groupNode);
			this.updateNode(this.getParent(groupNode));
		}
	}
}

class SuiteData {
	constructor(public readonly path: string, public readonly suites: SuiteTreeItem[]) { }
	public readonly groups: GroupTreeItem[] = [];
	public readonly tests: TestTreeItem[] = [];
}

export class SuiteTreeItem extends vs.TreeItem {
	public readonly groups: GroupTreeItem[] = [];
	public readonly tests: TestTreeItem[] = [];

	constructor(public suite: Suite) {
		super(vs.Uri.file(suite.path), vs.TreeItemCollapsibleState.Expanded);
		this.contextValue = DART_TEST_SUITE_NODE;
		this.id = `suite_${this.suite.path}_${this.suite.id}`;
	}

	get children(): Array<GroupTreeItem | TestTreeItem> {
		// Children should be:
		// 1. All children of any of our phantom groups
		// 2. Our children excluding our phantom groups
		return []
			.concat(this.groups)
			.concat(this.tests.filter((t) => !t.hidden));
	}
}

class GroupTreeItem extends vs.TreeItem {
	public readonly groups: GroupTreeItem[] = [];
	public readonly tests: TestTreeItem[] = [];

	constructor(public suite: SuiteData, public group: Group) {
		super(group.name, vs.TreeItemCollapsibleState.Expanded);
		this.contextValue = DART_TEST_GROUP_NODE;
		this.id = `suite_${this.suite.path}_group_${this.group.id}`;
	}

	get parent(): SuiteTreeItem | GroupTreeItem {
		const parent = this.group.parentID
			? this.suite.groups[this.group.parentID]
			: this.suite.suites[this.group.suiteID];

		return parent;
	}

	get children(): Array<GroupTreeItem | TestTreeItem> {
		return []
			.concat(this.groups)
			.concat(this.tests.filter((t) => !t.hidden));
	}
}

class TestTreeItem extends vs.TreeItem {
	private _test: Test; // tslint:disable-line:variable-name
	private _status: TestStatus; // tslint:disable-line:variable-name
	constructor(public suite: SuiteData, test: Test, public hidden = false) {
		super(test.name, vs.TreeItemCollapsibleState.None);
		this._test = test;
		this.resourceUri = vs.Uri.file(suite.path);
		this.id = `suite_${this.suite.path}_test_${this.test.id}`;
		// TODO: Allow re-running tests/groups/suites
		this.contextValue = DART_TEST_TEST_NODE;
	}

	get parent(): SuiteTreeItem | GroupTreeItem {
		const parent = this.test.groupIDs && this.test.groupIDs.length
			? this.suite.groups[this.test.groupIDs[this.test.groupIDs.length - 1]]
			: this.suite.suites[this.test.suiteID];

		return parent;
	}

	get status(): TestStatus {
		return this._status;
	}

	set status(status: TestStatus) {
		this._status = status;
		this.iconPath = getIconPath(status);
	}

	get test(): Test {
		return this._test;
	}

	set test(test: Test) {
		this._test = test;
		this.label = test.name;
	}
}

function getIconPath(status: TestStatus): vs.Uri {
	let file: string;
	switch (status) {
		case TestStatus.Running:
			file = "running";
			break;
		case TestStatus.Passed:
			file = "pass";
			break;
		case TestStatus.Failed:
		case TestStatus.Errored:
			file = "fail";
			break;
		case TestStatus.Skipped:
			file = "skip";
			break;
		case TestStatus.Stale:
		case TestStatus.Unknown:
			file = "stale";
			break;
		default:
			file = undefined;
	}

	return file
		? vs.Uri.file(path.join(extensionPath, `media/icons/tests/${file}.svg`))
		: undefined;
}

function getHighestChildStatus(node: SuiteTreeItem | GroupTreeItem): TestStatus {
	const childStatuses = node.children.map((c) => {
		if (c instanceof GroupTreeItem)
			return getHighestChildStatus(c);
		if (c instanceof TestTreeItem)
			return c.status;
		return TestStatus.Unknown;
	});
	return Math.max.apply(Math, childStatuses);
}

enum TestStatus {
	// This should be in order such that the highest number is the one to show
	// when aggregating (eg. from children).
	Stale,
	Unknown,
	Passed,
	Skipped,
	Failed,
	Errored,
	Running,
}
