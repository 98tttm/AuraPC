/**
 * Normalizer helpers for product specs.
 * Extracted from productRoutes.js for maintainability.
 * Each function takes a raw spec value string and returns a normalized string or null.
 */

/** Extract GPU chip name. e.g. "NVIDIA GeForce RTX 5060 (Blackwell)" → "GeForce RTX 5060" */
function normalizeGpuChip(val) {
    if (!val) return null;
    const m = val.match(/(?:GeForce\s+)?((?:RTX|GTX)\s*\d{3,5}(?:\s*(?:Ti|SUPER))?)/i);
    if (m) return 'GeForce ' + m[1].replace(/\s+/g, ' ').trim();
    const amd = val.match(/((?:Radeon\s+)?RX\s*\d{3,5}(?:\s*XT)?)/i);
    if (amd) return amd[1].replace(/\s+/g, ' ').trim();
    return null;
}

/** Extract VRAM amount. "8GB GDDR6" → "8GB" */
function normalizeVram(val) {
    if (!val) return null;
    const m = val.match(/(\d+)\s*GB/i);
    return m ? m[1] + 'GB' : null;
}

/** Extract CPU socket. "AMD Socket AM5 for..." → "AM5" */
function normalizeSocket(val) {
    if (!val) return null;
    const m = val.match(/(AM[45]|LGA\s*1[78]\d{2}|FCLGA\s*1[78]\d{2}|sTR5)/i);
    if (m) {
        const s = m[1].replace(/\s+/g, '').toUpperCase();
        return s.replace(/^FCLGA/, 'LGA');
    }
    return null;
}

/** Extract short CPU series. "Intel Core i5-14400F ..." → "Core i5-14400F" */
function normalizeCpuSeries(val) {
    if (!val) return null;
    let m = val.match(/(Core\s+Ultra\s+\d+\s+\d+\w*)/i);
    if (m) return m[1].replace(/\s+/g, ' ').trim();
    m = val.match(/(Core\s+i[3579]-?\d{4,5}\w*)/i);
    if (m) return m[1].replace(/\s+/g, ' ').trim();
    m = val.match(/(Ryzen\s+AI\s+\d+\s+\d+\w*)/i);
    if (m) return m[1].replace(/\s+/g, ' ').trim();
    m = val.match(/(Ryzen\s+[3579]\s+\d{3,5}\w*)/i);
    if (m) return m[1].replace(/\s+/g, ' ').trim();
    m = val.match(/(Athlon\s*\w*)/i);
    if (m) return m[1].trim();
    return null;
}

/** Extract chipset. "Intel® B760 Express Chipset" → "B760" */
function normalizeChipset(val) {
    if (!val) return null;
    const m = val.match(/\b([ABHXZ]\d{3,4}[EM]?)\b/i);
    return m ? m[1].toUpperCase() : null;
}

/** Normalize RAM type. "DDR5 SoDIMM" → "DDR5" */
function normalizeRamType(val) {
    if (!val) return null;
    const m = val.match(/(DDR[45])/i);
    return m ? m[1].toUpperCase() : null;
}

/** Normalize capacity for RAM/SSD. "16GB (2x8GB)" → "16GB" */
function normalizeCapacity(val) {
    if (!val) return null;
    const tb = val.match(/(\d+)\s*TB/i);
    if (tb) return tb[1] + 'TB';
    const gb = val.match(/(\d+)\s*GB/i);
    if (gb) {
        const num = parseInt(gb[1], 10);
        if (num >= 4 && num <= 8192) return num + 'GB';
    }
    return null;
}

/** Normalize RAM bus speed. "5600 MHz" → "5600MHz" */
function normalizeRamBus(val) {
    if (!val) return null;
    const m = val.match(/(\d{4,5})\s*(?:MHz|MT\/s|Mhz)/i);
    return m ? m[1] + 'MHz' : null;
}

/** Normalize SSD interface. "PCIe Gen 5.0 x4, NVMe 2.0" → "PCIe 5.0 NVMe" */
function normalizeSsdInterface(val) {
    if (!val) return null;
    if (/SATA/i.test(val)) return 'SATA III';
    const pcie = val.match(/PCIe?\s*(?:Gen\s*)?(\d)\.?\d?/i);
    if (pcie) {
        const hasNvme = /NVMe/i.test(val);
        return `PCIe ${pcie[1]}.0${hasNvme ? ' NVMe' : ''}`;
    }
    if (/NVMe/i.test(val)) return 'NVMe';
    return null;
}

/** Normalize SSD form factor. */
function normalizeSsdForm(val) {
    if (!val) return null;
    if (/M\.?2\s*2280/i.test(val) || /M\.?2/i.test(val)) return 'M.2';
    if (/2\.5/i.test(val)) return '2.5"';
    if (/3\.5/i.test(val)) return '3.5"';
    return null;
}

/** Normalize keyboard layout. Extract % or key count. */
function normalizeKbLayout(val) {
    if (!val) return null;
    if (/\b60\s*%/i.test(val)) return '60%';
    if (/\b65\s*%/i.test(val)) return '65%';
    if (/\b75\s*%/i.test(val)) return '75%';
    if (/\bTKL|80\s*%|87\s*phím|tenkeyless/i.test(val)) return 'TKL (80%)';
    if (/\b96\s*%|96\s*phím|97\s*phím|98\s*phím/i.test(val)) return '96%';
    if (/full\s*size|100\s*%|104\s*phím|108\s*phím/i.test(val)) return 'Full-size';
    return null;
}

/** Normalize connection type. Returns array or null. */
function normalizeConnection(val) {
    if (!val) return null;
    const results = [];
    if (/có dây|wired|USB(?:\s+Type)?(?:-[AC])?\s*(?:có dây)?/i.test(val) && !/không dây|wireless/i.test(val)) results.push('Có dây');
    if (/2\.4\s*G(?:Hz)?|wireless|không dây/i.test(val)) results.push('Wireless 2.4GHz');
    if (/bluetooth/i.test(val)) results.push('Bluetooth');
    if (/LIGHTSPEED|HyperSpeed|SpeedNova/i.test(val)) results.push('Wireless 2.4GHz');
    if (results.length === 0 && /USB/i.test(val)) results.push('Có dây');
    return results.length > 0 ? results : null;
}

/** Normalize mouse DPI. Extract max DPI number. */
function normalizeMouseDpi(val) {
    if (!val) return null;
    const nums = val.match(/(\d[\d,]*)\s*(?:DPI|dpi)/g);
    if (nums && nums.length > 0) {
        const values = nums.map(n => parseInt(n.replace(/[^\d]/g, ''), 10)).filter(n => n > 100);
        if (values.length > 0) {
            const max = Math.max(...values);
            return max.toLocaleString('en-US') + ' DPI';
        }
    }
    const m = val.match(/(\d[\d,]+)/);
    if (m) {
        const n = parseInt(m[1].replace(/,/g, ''), 10);
        if (n >= 400 && n <= 50000) return n.toLocaleString('en-US') + ' DPI';
    }
    return null;
}

module.exports = {
    normalizeGpuChip,
    normalizeVram,
    normalizeSocket,
    normalizeCpuSeries,
    normalizeChipset,
    normalizeRamType,
    normalizeCapacity,
    normalizeRamBus,
    normalizeSsdInterface,
    normalizeSsdForm,
    normalizeKbLayout,
    normalizeConnection,
    normalizeMouseDpi,
};
