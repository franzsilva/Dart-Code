import * as path from "path";
import * as vs from "vscode";
import { extensionPath } from "../extension";

let suite: SuiteTreeItem;

export class TestResultsProvider implements vs.TreeDataProvider<object> {
	private onDidChangeTreeDataEmitter: vs.EventEmitter<vs.TreeItem | undefined> = new vs.EventEmitter<vs.TreeItem | undefined>();
	public readonly onDidChangeTreeData: vs.Event<vs.TreeItem | undefined> = this.onDidChangeTreeDataEmitter.event;

	constructor() {
		setTimeout(() => this.sendFakeData(), 1000);
	}

	private sendFakeData() {
		suite = new SuiteTreeItem();

		const groupNode = new GroupTreeItem({ id: 1, parentID: null, name: "GROUP 1" });
		groupNode.parent.children.push(groupNode);

		const testNode1 = new TestTreeItem({ id: 2, name: "TEST 1 (INSIDE GROUP 1)" }, groupNode);
		groupNode.children.push(testNode1);

		const testNode2 = new TestTreeItem({ id: 3, name: "TEST 2 (NOT INSIDE GROUP)" }, suite);
		suite.children.push(testNode2);

		this.onDidChangeTreeDataEmitter.fire();
	}

	public getTreeItem(element: vs.TreeItem): vs.TreeItem {
		return element;
	}

	public getChildren(element?: vs.TreeItem): vs.TreeItem[] {
		if (!element) {
			return [suite];
		} else if (element instanceof SuiteTreeItem || element instanceof GroupTreeItem) {
			return element.children;
		}
	}

	public getParent?(element: vs.TreeItem): SuiteTreeItem | GroupTreeItem {
		if (element instanceof TestTreeItem || element instanceof GroupTreeItem)
			return element.parent;
	}
}

export class SuiteTreeItem extends vs.TreeItem {
	public readonly children: Array<GroupTreeItem | TestTreeItem> = [];

	constructor() {
		super("SUITE", vs.TreeItemCollapsibleState.Expanded);
		this.id = "suite";
		this.iconPath = vs.Uri.file(path.join(extensionPath, `media/icons/tests/pass.svg`));
	}
}

class GroupTreeItem extends vs.TreeItem {
	public readonly children: Array<GroupTreeItem | TestTreeItem> = [];

	constructor(public group: Group) {
		super(group.name, vs.TreeItemCollapsibleState.Expanded);
		this.id = `group`;
	}

	get parent(): SuiteTreeItem | GroupTreeItem {
		return suite;
	}
}

class TestTreeItem extends vs.TreeItem {
	private _status: string; // tslint:disable-line:variable-name
	constructor(public test: Test, public parent: SuiteTreeItem | GroupTreeItem) {
		super(test.name, vs.TreeItemCollapsibleState.None);
		this.id = `test_${this.test.id}`;

		// Comment this out to fix it...
		this.iconPath = vs.Uri.file(path.join(extensionPath, `media/icons/tests/pass.svg`));
	}
}

export interface Item {
	id: number;
	name?: string;
}

export interface Test extends Item {
	groupId?: number;
}

export interface Group extends Item {
	parentID?: number;
}
