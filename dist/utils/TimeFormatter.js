"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatSecondsToHHMMSS = formatSecondsToHHMMSS;
exports.calculateUsageTime = calculateUsageTime;
function formatSecondsToHHMMSS(seconds) {
    if (isNaN(seconds) || seconds < 0) {
        return "00:00:00";
    }
    seconds = Math.round(seconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = remainingSeconds.toString().padStart(2, '0');
    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}
/**
 * Calcula tempo total de uso formatado para relatórios
 * @param seconds Tempo em segundos
 * @returns Objeto com tempo formatado e valores individuais
 */
function calculateUsageTime(seconds) {
    if (isNaN(seconds) || seconds < 0) {
        seconds = 0;
    }
    seconds = Math.round(seconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = remainingSeconds.toString().padStart(2, '0');
    return {
        totalSeconds: seconds,
        hours,
        minutes,
        seconds: remainingSeconds,
        formatted: `${formattedHours}:${formattedMinutes}:${formattedSeconds}`,
        humanized: hours > 0
            ? `${hours}h ${minutes}min ${remainingSeconds}s`
            : (minutes > 0
                ? `${minutes}min ${remainingSeconds}s`
                : `${remainingSeconds}s`)
    };
}
