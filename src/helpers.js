export const toPx = (num) => `${num}px`;

export const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

export const renderDelay = (time = 1000) => new Promise((resolve) => setTimeout(resolve, time));
