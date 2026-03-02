/**
 * Tests for product normalizer functions.
 * Validates spec extraction from various vendor-specific string formats.
 */
const {
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
} = require('../utils/productNormalizers');

describe('normalizeGpuChip', () => {
    it('should extract NVIDIA GPU chip names', () => {
        expect(normalizeGpuChip('NVIDIA GeForce RTX 5060 (Blackwell)')).toBe('GeForce RTX 5060');
        expect(normalizeGpuChip('GeForce RTX 4070 Ti SUPER')).toBe('GeForce RTX 4070 Ti');
        expect(normalizeGpuChip('NVIDIA GTX 1650')).toBe('GeForce GTX 1650');
    });

    it('should extract AMD GPU chip names', () => {
        expect(normalizeGpuChip('AMD Radeon RX 7800 XT')).toBe('Radeon RX 7800 XT');
        expect(normalizeGpuChip('RX 7600')).toBe('RX 7600');
    });

    it('should return null for unrecognized', () => {
        expect(normalizeGpuChip(null)).toBeNull();
        expect(normalizeGpuChip('')).toBeNull();
        expect(normalizeGpuChip('Intel UHD 770')).toBeNull();
    });
});

describe('normalizeVram', () => {
    it('should extract VRAM amount', () => {
        expect(normalizeVram('8GB GDDR6')).toBe('8GB');
        expect(normalizeVram('12 GB GDDR7')).toBe('12GB');
        expect(normalizeVram('16GB')).toBe('16GB');
    });

    it('should return null for invalid', () => {
        expect(normalizeVram(null)).toBeNull();
        expect(normalizeVram('N/A')).toBeNull();
    });
});

describe('normalizeSocket', () => {
    it('should extract CPU socket', () => {
        expect(normalizeSocket('AMD Socket AM5 for Ryzen')).toBe('AM5');
        expect(normalizeSocket('LGA1700 socket support')).toBe('LGA1700');
        expect(normalizeSocket('FCLGA1700')).toBe('LGA1700');
        expect(normalizeSocket('Socket AM4')).toBe('AM4');
    });
});

describe('normalizeCpuSeries', () => {
    it('should extract Intel Core series', () => {
        expect(normalizeCpuSeries('Intel Core i5-14400F')).toBe('Core i5-14400F');
        expect(normalizeCpuSeries('Intel Core i7-14700K')).toBe('Core i7-14700K');
        expect(normalizeCpuSeries('Intel Core Ultra 9 285K')).toBe('Core Ultra 9 285K');
    });

    it('should extract AMD Ryzen series', () => {
        expect(normalizeCpuSeries('AMD Ryzen 5 7600X')).toBe('Ryzen 5 7600X');
        expect(normalizeCpuSeries('Ryzen 9 9900X')).toBe('Ryzen 9 9900X');
    });
});

describe('normalizeCapacity', () => {
    it('should extract TB values', () => {
        expect(normalizeCapacity('1TB NVMe')).toBe('1TB');
        expect(normalizeCapacity('2TB SSD')).toBe('2TB');
    });

    it('should extract GB values', () => {
        expect(normalizeCapacity('16GB (2x8GB)')).toBe('16GB');
        expect(normalizeCapacity('32GB DDR5')).toBe('32GB');
    });
});

describe('normalizeConnection', () => {
    it('should detect wired', () => {
        expect(normalizeConnection('USB có dây')).toEqual(['Có dây']);
    });

    it('should detect wireless', () => {
        expect(normalizeConnection('2.4GHz wireless + Bluetooth')).toEqual(['Wireless 2.4GHz', 'Bluetooth']);
    });

    it('should detect multiple connections', () => {
        const result = normalizeConnection('Bluetooth + LIGHTSPEED wireless');
        expect(result).toContain('Bluetooth');
        expect(result).toContain('Wireless 2.4GHz');
    });
});

describe('normalizeMouseDpi', () => {
    it('should extract max DPI', () => {
        expect(normalizeMouseDpi('26000 DPI')).toBe('26,000 DPI');
        expect(normalizeMouseDpi('400-16000 DPI adjustable')).toBe('16,000 DPI');
    });
});

describe('normalizeKbLayout', () => {
    it('should detect common layouts', () => {
        expect(normalizeKbLayout('75% layout')).toBe('75%');
        expect(normalizeKbLayout('TKL mechanical')).toBe('TKL (80%)');
        expect(normalizeKbLayout('Full size 104 phím')).toBe('Full-size');
        expect(normalizeKbLayout('65% compact')).toBe('65%');
    });
});

describe('normalizeSsdInterface', () => {
    it('should normalize PCIe NVMe', () => {
        expect(normalizeSsdInterface('PCIe Gen 5.0 x4, NVMe 2.0')).toBe('PCIe 5.0 NVMe');
        expect(normalizeSsdInterface('PCIe Gen 4.0')).toBe('PCIe 4.0');
    });

    it('should detect SATA', () => {
        expect(normalizeSsdInterface('SATA III 6Gbps')).toBe('SATA III');
    });
});

describe('normalizeChipset', () => {
    it('should extract chipset names', () => {
        expect(normalizeChipset('Intel® B760 Express Chipset')).toBe('B760');
        expect(normalizeChipset('AMD B650E')).toBe('B650E');
        expect(normalizeChipset('X670')).toBe('X670');
    });
});
