import React, { JSX } from "react";

type SkeletonProps = {
    className?: string;
    "aria-hidden"?: boolean;
};

export function Skeleton({ className = "h-6 w-full rounded-md bg-slate-200/60", "aria-hidden": ah = true }: SkeletonProps): JSX.Element {
    return <div aria-hidden={ah} className={`${className} animate-pulse`} />;
}
