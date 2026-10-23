"use client";

import { useId } from "react";

export interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function Slider({ label, value, onChange, min = 1, max = 5 }: SliderProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id} className="text-ink">
          {label}
        </label>
        <span aria-hidden="true" className="font-medium text-accent">
          {value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}
