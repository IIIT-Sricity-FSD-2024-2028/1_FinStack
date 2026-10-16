// Structural copy of the recovered pre-SPA landing page, rendered by React.
import { createElement } from "react";
import { Link } from "react-router-dom";
import baseline from "./baseline-home.json";
const attributes = {
  class: "className",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  tabindex: "tabIndex",
};
function render(node, key, pricing) {
  if (typeof node === "string") return node;
  if (node.tag === "script") return null;
  // Hide retired contact and employee-account-request entry points in the restored home snapshot.
  if (node.attrs.id === "contact") return null;
  if (node.tag === "a" && (node.attrs.href === "#contact" ||
      node.attrs.href?.includes("account-request"))) return null;
  if (node.attrs.id === "pricing") return pricing;
  const props = { key };
  for (const [name, value] of Object.entries(node.attrs)) {
    if (name.startsWith("on")) continue;
    if (name === "style") {
      props.style = Object.fromEntries(
        value
          .split(";")
          .filter((item) => item.includes(":"))
          .map((item) => {
            const [property, ...rest] = item.split(":");
            return [
              property
                .trim()
                .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
              rest.join(":").trim(),
            ];
          }),
      );
    } else props[attributes[name] || name] = value;
  }
  let tag = node.tag;
  if (
    tag === "a" &&
    props.href &&
    !props.href.startsWith("#") &&
    !/^https?:/.test(props.href)
  ) {
    tag = Link;
    props.to = props.href.includes("register")
      ? "/register"
      : props.href.includes("login")
        ? "/login"
        : props.href.includes("help")
          ? "/help"
          : "/";
    delete props.href;
  }
  return createElement(
    tag,
    props,
    ...node.children.map((child, index) => render(child, index, pricing)),
  );
}
export function BaselineHome({ pricing }) {
  return render(baseline, "home", pricing);
}
