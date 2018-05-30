import * as path from "path";
import * as vs from "vscode";
import { extensionPath } from "../extension";
import { Group, GroupNotification, Suite, SuiteNotification, Test, TestDoneNotification, TestStartNotification } from "./test_protocol";

let suiteData: SuiteData;

export class TestResultsProvider implements vs.TreeDataProvider<object> {
	private onDidChangeTreeDataEmitter: vs.EventEmitter<vs.TreeItem | undefined> = new vs.EventEmitter<vs.TreeItem | undefined>();
	public readonly onDidChangeTreeData: vs.Event<vs.TreeItem | undefined> = this.onDidChangeTreeDataEmitter.event;

	constructor() {
		setTimeout(() => this.sendFakeData(), 5000);
	}

	private sendFakeData() {
		const suitePath = "/Users/dantup/Dev/Google/flutter/examples/flutter_gallery/test/calculator/logic.dart";
		this.handleSuiteNotification(suitePath, { suite: { id: 0, path: "/Users/dantup/Dev/Google/flutter/examples/flutter_gallery/test/calculator/logic.dart" }, type: "suite" });
		this.handleGroupNotification(suiteData, { group: { id: 3, suiteID: 0, parentID: null, name: "GROUP 1" }, type: "group" });
		this.handleTestStartNotifcation(suiteData, { test: { id: 4, name: "TEST 1 (INSIDE GROUP 1)", suiteID: 0, groupIDs: [3] }, type: "testStart" });
		this.handleTestDoneNotification(suiteData, { testID: 4, type: "testDone" });
		this.handleTestStartNotifcation(suiteData, { test: { id: 5, name: "TEST 2 (NOT INSIDE GROUP)", suiteID: 0, groupIDs: [] }, type: "testStart" });
		this.handleTestDoneNotification(suiteData, { testID: 5, type: "testDone" });
	}

	public getTreeItem(element: vs.TreeItem): vs.TreeItem {
		return element;
	}

	public getChildren(element?: vs.TreeItem): vs.TreeItem[] {
		if (!element) {
			return suiteData && suiteData.suites;
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

	private handleSuiteNotification(suitePath: string, evt: SuiteNotification) {
		const suite = new SuiteTreeItem(evt.suite);
		suiteData = new SuiteData(suitePath, [suite]);
		suite.iconPath = getIconPath("running");
		this.updateNode(null);
	}

	private handleTestStartNotifcation(suite: SuiteData, evt: TestStartNotification) {
		const isExistingTest = false;
		const testNode = suite.tests[evt.test.id] || new TestTreeItem(suite, evt.test);

		suite.tests[evt.test.id] = testNode;
		testNode.status = "running";
		testNode.test = evt.test;
		testNode.parent.tests.push(testNode);

		this.updateNode(testNode);
		this.updateNode(this.getParent(testNode));
	}

	private handleTestDoneNotification(suite: SuiteData, evt: TestDoneNotification) {
		const testNode = suite.tests[evt.testID];
		testNode.status = "pass";
		this.updateNode(testNode);
	}

	private handleGroupNotification(suite: SuiteData, evt: GroupNotification) {
		const groupNode = new GroupTreeItem(suite, evt.group);
		suite.groups[evt.group.id] = groupNode;
		groupNode.parent.groups.push(groupNode);
		this.updateNode(this.getParent(groupNode));
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
		super("SUITE", vs.TreeItemCollapsibleState.Expanded);
		this.id = `suite_${this.suite.path}_${this.suite.id}`;
	}

	get children(): Array<GroupTreeItem | TestTreeItem> {
		return []
			.concat(this.groups)
			.concat(this.tests);
	}
}

class GroupTreeItem extends vs.TreeItem {
	public readonly groups: GroupTreeItem[] = [];
	public readonly tests: TestTreeItem[] = [];

	constructor(public suite: SuiteData, public group: Group) {
		super(group.name, vs.TreeItemCollapsibleState.Expanded);
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
			.concat(this.tests);
	}
}

class TestTreeItem extends vs.TreeItem {
	private _test: Test; // tslint:disable-line:variable-name
	private _status: string; // tslint:disable-line:variable-name
	constructor(public suite: SuiteData, test: Test) {
		super(test.name, vs.TreeItemCollapsibleState.None);
		this._test = test;
		this.id = `suite_${this.suite.path}_test_${this.test.id}`;
	}

	get parent(): SuiteTreeItem | GroupTreeItem {
		const parent = this.test.groupIDs && this.test.groupIDs.length
			? this.suite.groups[this.test.groupIDs[this.test.groupIDs.length - 1]]
			: this.suite.suites[this.test.suiteID];

		return parent;
	}

	get status(): string {
		return this._status;
	}

	set status(status: string) {
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

function getIconPath(file: string): vs.Uri {
	return file
		? vs.Uri.file(path.join(extensionPath, `media/icons/tests/${file}.svg`))
		: undefined;
}
