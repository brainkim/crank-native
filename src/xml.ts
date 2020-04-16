import {
	Default,
	Environment,
	Intrinsic,
	IntrinsicProps,
	Portal,
	Renderer,
	Text,
} from "@bikeshaving/crank/cjs/index";

// declare module "./index" {
// 	interface EventMap extends GlobalEventHandlersEventMap {}
// }

function escapeText(text: string): string {
	return text.replace(/[&<>"']/g, (m) => {
		switch (m) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			case "'":
				return "&#039;";
			default:
				throw new Error("Bad match");
		}
	});
}

function printStyle(style: Record<string, string>): string {
	const cssStrings = [];
	for (const [name, value] of Object.entries(style)) {
		if (value != null) {
			cssStrings.push(`${name}:${value};`);
		}
	}

	return cssStrings.join("");
}

function printAttrs(props: IntrinsicProps<string>): string {
	const attrs: string[] = [];
	for (const [name, value] of Object.entries(props)) {
		switch (true) {
			case name === "children":
				break;
			case name === "style":
				attrs.push(`style="${printStyle(value)}"`);
				break;
			case typeof value === "string":
				attrs.push(`${escapeText(name)}="${escapeText(value)}"`);
				break;
			case typeof value === "number":
				attrs.push(`${escapeText(name)}="${value}"`);
				break;
			case typeof value === "boolean":
				attrs.push(`${escapeText(name)}`);
				break;
		}
	}

	return attrs.join(" ");
}

/**
 * I'm not sure whether NativeScript has any void tags at all.
 */
const voidTags = new Set([
	// "area",
	// "base",
	// "br",
	// "col",
	// "command",
	// "embed",
	// "hr",
	// "img",
	// "input",
	// "keygen",
	// "link",
	// "meta",
	// "param",
	// "source",
	// "track",
	// "wbr",
]);

export const env: Environment<string> = {
	[Default](tag: string): Intrinsic<string> {
		return function defaultString(props: IntrinsicProps<string>): string {
			const attrs = printAttrs(props);
			const open = `<${tag}${attrs.length ? " " : ""}${attrs}>`;
			if (voidTags.has(tag)) {
				return open;
			}

			const close = `</${tag}>`;

			return `${open}${props.children.join("")}${close}`;
		};
	},
	[Text](text: string): string {
		return escapeText(text);
	},
	[Portal]({children}): string {
		return children.join("");
	},
};

export class StringRenderer extends Renderer<string> {
	constructor() {
		super(env);
	}
}

export const renderer = new StringRenderer();