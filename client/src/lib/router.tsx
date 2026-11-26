/**
 * Thin routing layer over wouter (~2 KB gz vs ~15 KB for react-router) so the public
 * landing stays under its JS budget (DESIGN.md §8b). App code imports from here only.
 */
import type { ComponentProps, ReactNode } from "react";
import { Link as WouterLink, Redirect, Route, Switch } from "wouter";
import { usePathname, type NavigateOptions } from "@/lib/router-hooks";

export { Route, Switch };

export function Navigate({ to, replace = true, state }: { to: string } & NavigateOptions) {
  return <Redirect to={to} replace={replace} state={state} />;
}

export function Link({ to, ...props }: { to: string } & Omit<ComponentProps<"a">, "href">) {
  return <WouterLink to={to} {...props} />;
}

/** Active when the path equals `to` or is nested under it (e.g. /admin/campaigns/new). */
export function NavLink({
  to,
  className,
  children,
  ...props
}: { to: string; className: (isActive: boolean) => string; children: ReactNode } & Omit<
  ComponentProps<"a">,
  "href" | "className" | "children"
>) {
  const path = usePathname();
  const active = path === to || path.startsWith(`${to}/`);
  return (
    <WouterLink to={to} className={className(active)} aria-current={active ? "page" : undefined} {...props}>
      {children}
    </WouterLink>
  );
}
