import React, { JSX } from "react";

type SpinnerProps = {
    size?: number; 
    className?: string;
    "aria-label"?: string;
};


export default function Spinner({
    size = 16,
    className = "",
    "aria-label": ariaLabel = "Loading",
}: SpinnerProps): JSX.Element {
    const strokeWidth = Math.max(2, Math.round(size / 8));
    return (
        <svg
            role="status"
            aria-label={ariaLabel}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className={`animate-spin inline-block ${className}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
        >
            <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeWidth={strokeWidth}
            />
            <path
                d="M22 12a10 10 0 0 1-10 10"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
        </svg>
    );
}
