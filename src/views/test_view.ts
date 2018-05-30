import * as path from "path";
import * as vs from "vscode";
import { extensionPath } from "../extension";
import { Group, GroupNotification, Suite, SuiteNotification, Test, TestStartNotification } from "./test_protocol";

let suite: SuiteTreeItem;

export class TestResultsProvider implements vs.TreeDataProvider<object> {
	private onDidChangeTreeDataEmitter: vs.EventEmitter<vs.TreeItem | undefined> = new vs.EventEmitter<vs.TreeItem | undefined>();
	public readonly onDidChangeTreeData: vs.Event<vs.TreeItem | undefined> = this.onDidChangeTreeDataEmitter.event;

	constructor() {
		setTimeout(() => this.sendFakeData(), 5000);
	}

	private sendFakeData() {
		const suitePath = "/Users/dantup/Dev/Google/flutter/examples/flutter_gallery/test/calculator/logic.dart";
		this.handleSuiteNotification(suitePath, { suite: { id: 0, path: "/Users/dantup/Dev/Google/flutter/examples/flutter_gallery/test/calculator/logic.dart" }, type: "suite" });
		this.handleGroupNotification({ group: { id: 3, suiteID: 0, parentID: null, name: "GROUP 1" }, type: "group" });
		this.handleTestStartNotifcation({ test: { id: 4, name: "TEST 1 (INSIDE GROUP 1)", suiteID: 0, groupId: 3 }, type: "testStart" });
		this.handleTestStartNotifcation({ test: { id: 5, name: "TEST 2 (NOT INSIDE GROUP)", suiteID: 0 }, type: "testStart" });
	}

	public getTreeItem(element: vs.TreeItem): vs.TreeItem {
		return element;
	}

	public getChildren(element?: vs.TreeItem): vs.TreeItem[] {
		if (!element) {
			return suite && [suite];
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
		suite = new SuiteTreeItem(evt.suite);
		suite.iconPath = getIconPath("running");
		this.updateNode(null);
	}

	private handleTestStartNotifcation(evt: TestStartNotification) {
		const testNode = new TestTreeItem(evt.test);

		testNode.status = "running";
		testNode.test = evt.test;
		testNode.parent.children.push(testNode);

		this.updateNode(testNode);
		this.updateNode(testNode.parent);
	}

	private handleGroupNotification(evt: GroupNotification) {
		const groupNode = new GroupTreeItem(evt.group);
		groupNode.parent.children.push(groupNode);
		this.updateNode(groupNode.parent);
	}
}

export class SuiteTreeItem extends vs.TreeItem {
	public readonly children: Array<GroupTreeItem | TestTreeItem> = [];

	constructor(public suite: Suite) {
		super("SUITE", vs.TreeItemCollapsibleState.Expanded);
		this.id = `suite_${this.suite.path}_${this.suite.id}`;
	}
}

class GroupTreeItem extends vs.TreeItem {
	public readonly children: Array<GroupTreeItem | TestTreeItem> = [];

	constructor(public group: Group) {
		super(group.name, vs.TreeItemCollapsibleState.Expanded);
		this.id = `group_${this.group.id}`;
	}

	get parent(): SuiteTreeItem | GroupTreeItem {
		return suite;
	}
}

class TestTreeItem extends vs.TreeItem {
	private _test: Test; // tslint:disable-line:variable-name
	private _status: string; // tslint:disable-line:variable-name
	constructor(test: Test) {
		super(test.name, vs.TreeItemCollapsibleState.None);
		this._test = test;
		this.id = `test_${this.test.id}`;
	}

	get parent(): SuiteTreeItem | GroupTreeItem {
		return this.test.groupId
			? suite.children.find((c) => c instanceof GroupTreeItem && c.group.id === this.test.groupId) as GroupTreeItem
			: suite;
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
