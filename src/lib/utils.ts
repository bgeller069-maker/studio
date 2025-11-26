import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  const isInteger = amount % 1 === 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: isInteger ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date) {
  return format(new Date(date), 'dd/MM/yyyy');
}

/**
 * Safely evaluates a simple mathematical expression from a string.
 * Supports addition, subtraction, multiplication, and division.
 * Does not use `eval()` to prevent security risks.
 * @param expression The string expression to evaluate (e.g., "100+50-25").
 * @returns The result of the calculation.
 * @throws An error if the expression is invalid or contains unsupported characters.
 */
export function evaluateMathExpression(expression: string): number {
  const sanitizedExpression = expression.replace(/\s+/g, '');
  if (!/^[0-9.+\-*/()]*$/.test(sanitizedExpression)) {
    throw new Error('Invalid characters in expression.');
  }

  try {
    const result = new Function('return ' + sanitizedExpression)();
    if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Invalid calculation result.');
    }
    return result;
  } catch (error) {
    console.error("Could not evaluate expression:", error);
    throw new Error('Invalid mathematical expression.');
  }
}
