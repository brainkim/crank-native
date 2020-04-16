import {
	HostContext,
	Default,
	Environment,
	Intrinsic,
	Props,
	Raw,
	Renderer,
	Portal,
} from "@bikeshaving/crank/cjs/index";
import { setValueForProperty } from "./NativeScriptPropertyOperations";
import { Instance, HostContext as RNSHostContext, TextInstance } from "./HostConfigTypes";
import { StackLayout, LayoutBase, GridLayout, View, ViewBase, Page, ActionBar, ActionItem, NavigationButton, TabView, TabViewItem, ContentView, ScrollView } from "@nativescript/core";

const rootHostContext: RNSHostContext = {
    isInAParentText: false,
    isInAParentSpan: false,
    isInAParentFormattedString: false,
    isInADockLayout: false,
    isInAGridLayout: false,
    isInAnAbsoluteLayout: false,
    isInAFlexboxLayout: false,
};

// declare module "./index" {
// 	interface EventMap extends GlobalEventHandlersEventMap {}
// }

// TODO: create an allowlist/blocklist of props
function updateProps(el: Instance, props: Props, newProps: Props): void {
    for (const name in {...props, ...newProps}) {
        const value = props[name];
		const newValue = newProps[name];
        setValueForProperty(
            el,
            name,
            newValue,
            false,
            rootHostContext, // TODO @shirakaba: implement correct RNS Host Context rather than default one.
        );
    }
}

function isASingleChildContainer(view: Instance): view is Page | ContentView | ScrollView {
    return view instanceof ContentView || view instanceof Page || view instanceof ScrollView;
}

function appendChild(parentInstance: Instance, child: Instance | TextInstance): void {
    if (parentInstance === null) {
        console.warn(
            `[appendChild()] parent is null (this is a typical occurrence when rendering a child into a detached tree); shall no-op here: ${parentInstance} > ${child}`
        );
        return;
    }

    // if (implementsCustomNodeHierarchyManager(parentInstance) && parentInstance.__customHostConfigAppendChild) {
    //     console.log(`[appendChild()] Deferring to customHostConfigAppendChild(): ${parentInstance} > ${child}`);
    //     const handled: boolean = parentInstance.__customHostConfigAppendChild(parentInstance, child);
    //     if (handled) {
    //         return;
    //     }
    //     console.log(
    //         `[appendChild()] Deferral to customHostConfigAppendChild() didn't handle, so handling with default implementation: ${parent} > ${child}`
    //     );
    // }

    if (child instanceof Page) {
        console.warn(
            `[appendChild()] Page cannot be appended as a true child; no-op for: ${parentInstance} > ${child}`
        );
        return;
    } else if (child instanceof ActionBar && parentInstance instanceof Page) {
        console.log(`[appendChild()] (Page receiving ActionBar) ${parentInstance} > ${child}`);
        parentInstance.actionBar = child;
        return;
    } else if (isASingleChildContainer(parentInstance)) {
        console.log(`[appendChild()] (single-child container) ${parentInstance} > ${child}`);
        /* These elements were originally designed to hold one element only:
         * https://stackoverflow.com/a/55351086/5951226 */

        parentInstance.content = child as View;
    } else if (parentInstance instanceof LayoutBase) {
        console.log(`[appendChild()] (instance of LayoutBase) ${parentInstance} > ${child}`);
        parentInstance.addChild(child as View);
    } else if (parentInstance instanceof ActionBar) {
        if (child instanceof ActionItem) {
            if (child instanceof NavigationButton) {
                console.log(`[appendChild()] (instance of NavigationButton) ${parentInstance} > ${child}`);
                parentInstance.navigationButton = child;
            } else if (child instanceof ActionItem) {
                console.log(`[appendChild()] (instance of ActionItem) ${parentInstance} > ${child}`);
                parentInstance.actionItems.addItem(child);
            }
        } else {
            // Take to be titleView
            console.log(`[appendChild()] (not ActionItem; assumed to be titleView) ${parentInstance} > ${child}`);
            parentInstance.titleView = child as View;
        }
    } else if (parentInstance instanceof ActionItem) {
        // Same for both ActionItem and NavigationButton.
        parentInstance.actionView = child as View;
    } else if (parentInstance instanceof TabView && child instanceof TabViewItem) {
        console.log(
            `[appendChild()] Remapping TabViewItem from child to item: ${parentInstance} > ${child}, where the child's view was ${child.view} and the parent's items were:`,
            parentInstance.items
        );
        /* We must go through the setter rather than simply mutate the existing array. */
        const newItems = [...(parentInstance.items || []), child];
        parentInstance.items = newItems;
        // console.log(`[appendChild()] parentInstance.items now updated to:`, parentInstance.items);
    } else if (parentInstance instanceof TabViewItem) {
        console.log(`[appendChild()] (instance of TabViewItem) ${parentInstance} > ${child}`);
        parentInstance.view = child as View;
    } else {
        console.log(`[appendChild()] (default clause) ${parentInstance} > ${child}`);
        parentInstance._addView(child);
    }
    // TODO: check whether a property/event change should be fired.
}

function insertBefore(parentInstance: Instance, child: Instance | TextInstance, beforeChild: Instance | TextInstance): void {
    console.log(`[HostConfig.insertBefore] ${parentInstance} > ${child} beforeChild ${beforeChild}`);

    // if (implementsCustomNodeHierarchyManager(parentInstance) && parentInstance.__customHostConfigInsertBefore) {
    //     console.log(
    //         `[insertBefore()] Deferring to customHostConfigInsertBefore(): ${parentInstance} > ${child} beforeChild ${beforeChild}`
    //     );
    //     const handled: boolean = parentInstance.__customHostConfigInsertBefore(parentInstance, child, beforeChild);
    //     if (handled) {
    //         return;
    //     }
    //     console.log(
    //         `[insertBefore()] Deferral to customHostConfigInsertBefore() didn't handle, so handling with default implementation: ${parentInstance} > ${child} beforeChild ${beforeChild}`
    //     );
    // }

    if (parentInstance instanceof LayoutBase) {
        /* TODO: implement this for GridLayout, if feeling brave! An example use case (and test case) would help. */
        if (parentInstance instanceof GridLayout) {
            console.warn(
                `HostConfig.insertBefore() LayoutBase implementation has not been tested specifically for GridLayout!`
            );
            // addChildAtCell(view: View, row: number, column: number, rowSpan?: number, columnSpan?: number): void;
        }

        /* Implementation from:
         * https://github.com/nativescript-vue/nativescript-vue/blob/master/platform/nativescript/renderer/ViewNode.js#L164
         * https://github.com/nativescript-vue/nativescript-vue/blob/master/platform/nativescript/renderer/utils.js#L32
         */
        if (child.parent === parentInstance) {
            const index: number = parentInstance.getChildIndex(child as View);
            if (index !== -1) {
                console.log(
                    `[HostConfig.insertBefore] Provisionally calling ${parentInstance}.removeChild(${child}).`
                );
                parentInstance.removeChild(child as View);
            }
        }

        const atIndex: number = parentInstance.getChildIndex(beforeChild as View);
        if (atIndex === -1) {
            console.log(
                `[HostConfig.insertBefore] calculated atIndex as ${atIndex}; shall call: ${parentInstance}.addChild(${child})`
            );
            parentInstance.addChild(child as View);
        } else {
            console.log(
                `[HostConfig.insertBefore] calculated atIndex as ${atIndex}; shall call: ${parentInstance}.insertChild(${child}, ${atIndex})`
            );
            parentInstance.insertChild(child as View, atIndex);
        }
    } else {
        console.warn(
            `[HostConfig.insertBefore] parentInstance was not a LayoutBase, so deferring to hostConfig.appendChild() with: ${parentInstance} > ${child} beforeChild ${beforeChild}`
        );
        appendChild(parentInstance, child);
    }
}

function removeChild(parent: Instance, child: Instance | TextInstance): void {
    if (parent === null) {
        // TODO: consult React expert here!
        console.warn(
            `[removeChild()] parent is null (this is a typical occurrence when unmounting a Portal that was rendered into a null parent); shall no-op here, but totally unsure whether this leaks memory: ${parent} x ${child}`
        );
        return;
    }
    // if (implementsCustomNodeHierarchyManager(parent) && parent.__customHostConfigRemoveChild) {
    //     console.log(`[removeChild()] Deferring to customHostConfigRemoveChild(): ${parent} x ${child}`);
    //     const handled: boolean = parent.__customHostConfigRemoveChild(parent, child);
    //     if (handled) {
    //         return;
    //     }
    //     console.log(
    //         `[removeChild()] Deferral to customHostConfigRemoveChild() didn't handle, so handling with default implementation: ${parent} x ${child}`
    //     );
    // }

    if (child instanceof Page) {
        console.warn(`[remove()] Page was never a real child in the first place, so no-op. ${parent} x ${child}`);
        return;
    } else if (isASingleChildContainer(parent)) {
        console.log(`[removeChild()] instance of single-child parent: ${parent} x ${child}`);
        /* These elements were originally designed to hold one element only:
         * https://stackoverflow.com/a/55351086/5951226 */
        console.warn(`[removeChild()] TODO: Check whether "parent.content = null" will indeed remove the content.`);
        parent.content = null;
    } else if (parent instanceof LayoutBase) {
        /** For logging purposes only **/
        const childrenBefore = [];
        parent.eachChild((viewBase: ViewBase) => {
            childrenBefore.push(viewBase);
            return true;
        });
        console.log(
            `[removeChild()] parent instance of LayoutBase. Current children: [${childrenBefore}]: ${parent} x ${child}`
        );
        /*******************************/

        parent.removeChild(child as View);

        /** For logging purposes only **/
        const childrenAfter = [];
        parent.eachChild((viewBase: ViewBase) => {
            childrenAfter.push(viewBase);
            return true;
        });
        console.log(`[removeChild()] completed. Children now: [${childrenAfter}]`);
        /*******************************/
    } else if (child instanceof ActionBar && parent instanceof Page) {
        console.log(
            `[removeChild()] Detaching ActionBar from Page forbidden in NativeScript Core, so no-op: ${parent} x ${child}`
        );
        return;
    } else if (parent instanceof ActionBar) {
        if (child instanceof ActionItem) {
            if (child instanceof NavigationButton) {
                console.log(`[removeChild()] (instance of NavigationButton) ${parent} x ${child}`);
                parent.navigationButton = null; // Anything falsy should work.
            } else if (child instanceof ActionItem) {
                console.log(`[removeChild()] (instance of ActionItem) ${parent} x ${child}`);
                parent.actionItems.removeItem(child);
            }
        } else {
            // Take to be titleView
            console.log(`[removeChild()] (not ActionItem; assumed to be titleView) ${parent} x ${child}`);
            parent.titleView = null;
        }
    } else if (parent instanceof ActionItem) {
        // Same for both ActionItem and NavigationButton.
        parent.actionView = null;
    } else if (parent instanceof TabView && child instanceof TabViewItem) {
        console.log(`[removeChild()] ${parent} x ${child}`);
        if (!parent.items) {
            parent.items = [];
        }
        parent.items = parent.items.filter(i => i !== child);
    } else if (parent instanceof TabViewItem) {
        console.log(
            `[removeChild()] Detaching view from TabViewItem not supported in NativeScript Core, so no-op: ${parent} x ${child}`
        );
        return;
        /* FormattedString > Span case seems to be handled just fine by default clauses (somehow) */
        // } else if (parent instanceof FormattedString) {
        //     if(child instanceof Span){
        //         console.log(`[removeChild()] FormattedString x Span`);
        //         const childIndex: number = parent.spans.indexOf(child);
        //         parent.spans.splice(childIndex, 1);
        //     }
    } else {
        console.log(`[removeChild()] default clause: ${parent} x ${child}`);
        parent._removeView(child);
    }
}

// TODO: improve this algorithm
// https://stackoverflow.com/questions/59418120/what-is-the-most-efficient-way-to-update-the-childnodes-of-a-dom-node-with-an-ar
function updateChildren(el: Element, children: Array<Node | string>): void {
    // TODO @shirakaba: re-implement for NativeScript!

	if (el.childNodes.length === 0) {
		const fragment = document.createDocumentFragment();
		for (let child of children) {
			if (typeof child === "string") {
				child = document.createTextNode(child);
			}

			fragment.appendChild(child);
		}

		el.appendChild(fragment);
		return;
	}

	let oldChild = el.firstChild;
	for (const newChild of children) {
		if (oldChild === null) {
			el.appendChild(
				typeof newChild === "string"
					? document.createTextNode(newChild)
					: newChild,
			);
		} else if (typeof newChild === "string") {
			if (oldChild.nodeType === Node.TEXT_NODE) {
				if (oldChild.nodeValue !== newChild) {
					oldChild.nodeValue = newChild;
				}

				oldChild = oldChild.nextSibling;
			} else {
				el.insertBefore(document.createTextNode(newChild), oldChild);
			}
		} else if (oldChild !== newChild) {
			el.insertBefore(newChild, oldChild);
		} else {
			oldChild = oldChild.nextSibling;
		}
	}

	while (oldChild !== null) {
		const nextSibling = oldChild.nextSibling;
		el.removeChild(oldChild);
		oldChild = nextSibling;
	}
}

function createDocumentFragmentFromHTML(html: string): DocumentFragment {
    // TODO @shirakaba: determine what should be implemented, analogous to a document fragment.
	if (typeof document.createRange === "function") {
		return document.createRange().createContextualFragment(html);
	} else {
		const fragment = document.createDocumentFragment();
		const childNodes = new DOMParser().parseFromString(html, "text/html").body
			.childNodes;
		for (let i = 0; i < childNodes.length; i++) {
			fragment.appendChild(childNodes[i]);
		}

		return fragment;
	}
}

// TODO: Element should be ParentNode maybe?
export const env: Environment<Instance> = {
	[Default](tag: string): Intrinsic<Instance> {
		return function* defaultDOM(this: HostContext): Generator<Instance> {
            const node = new StackLayout();
			let props: Props = {};
			let nextProps: Props;
			let children: Array<Element | string> = [];
			let nextChildren: Array<Element | string>;
			for ({children: nextChildren, ...nextProps} of this) {
				updateProps(node, props, nextProps);
                props = nextProps;
				if (children.length > 0 || nextChildren.length > 0) {
                    // TODO @shirakaba: somehow map updateChildren to appendChild() (etc.) calls...
					// updateChildren(node, nextChildren);
					children = nextChildren;
				}

				yield node;
			}
		};
	},
	[Raw]({value}): Instance {
		if (typeof value === "string") {
            // TODO @shirakaba: determine what should be implemented, analogous to a document fragment.
			// TODO: figure out what the type of element should actually be
			return (createDocumentFragmentFromHTML(value) as unknown) as Instance;
		} else {
			return value;
		}
	},
	*[Portal](this: HostContext, {root}): Generator<Instance> {
		if (root == null) {
			throw new TypeError("Portal element is missing root node");
		}

		try {
			for (const {root: newRoot, children} of this) {
				if (newRoot == null) {
					throw new TypeError("Portal element is missing root node");
				}

				if (root !== newRoot) {
                    // TODO @shirakaba: somehow map updateChildren to appendChild() (etc.) calls...
					updateChildren(root, []);
					root = newRoot;
				}

                // TODO @shirakaba: somehow map updateChildren to appendChild() (etc.) calls...
				updateChildren(root, children);
				yield root;
			}
		} finally {
            // TODO @shirakaba: somehow map updateChildren to appendChild() (etc.) calls...
			updateChildren(root, []);
		}
	},
};

export class NativeScriptRenderer extends Renderer<Instance> {
	constructor() {
		super(env);
	}
}

export const renderer = new NativeScriptRenderer();