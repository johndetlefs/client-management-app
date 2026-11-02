export const money = (minor: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(minor / 100);
export const fieldClass = "w-full min-w-0 rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm";
export const buttonClass = "rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40";
export const secondaryClass = "rounded-lg border border-foreground/20 px-3 py-2 text-sm disabled:opacity-40";
