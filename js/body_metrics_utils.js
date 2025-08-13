// Bestand: body_metrics_utils.js
// Bevat klassen voor het berekenen van lichaamsstandaarden, VO2 Max en hardlooptijden.

export class Bodystandard {
    /**
     * Berekent diverse lichaamsstandaarden op basis van de opgegeven parameters.
     * @param {object} params - Object met parameters.
     * @param {string} params.gender - Geslacht ("male" of "female").
     * @param {number} params.age - Leeftijd in jaren.
     * @param {number} params.weight - Gewicht in kg.
     * @param {number} params.height - Lengte in cm.
     * @param {number} params.fatPercentage - Vetpercentage.
     */
    constructor({ gender, age, weight, height, fatPercentage }) {
        this.LBM = Math.round(weight - (weight * (fatPercentage / 100))); // Lean Body Mass
        this.fatMass = Math.round(weight * fatPercentage / 100);
        this.muscleMass = Math.round(this.LBM * 0.45); // Geschatte spiermassa (voorbeeld)
        this.bmi = Math.round(weight / ((height / 100) * (height / 100))); // Body Mass Index
        this.idealWeightBMI = Math.round((height / 100) * (height / 100) * 22.5); // Ideaal gewicht bij BMI van 22.5

        // BMR (Basal Metabolic Rate) en Metabolische Leeftijd berekeningen volgens Harris-Benedict formule (aangepast)
        if (gender === "male") {
            this.metabolicAge = Math.round(((10 * weight) + (6.25 * height) - (5 * age) + 5) / 100);
            this.bmr = Math.round(66.4730 + (13.7516 * weight) + (5.0033 * height) - (6.7550 * age));
        } else if (gender === "female") {
            this.metabolicAge = Math.round(((10 * weight) + (6.25 * height) - (5 * age) - 161) / 100);
            this.bmr = Math.round(655.0955 + (9.5634 * weight) + (1.8496 * height) - (4.6756 * age));
        } else {
            this.metabolicAge = 0;
            this.bmr = 0;
        }
    }
}

export class VO2 {
    /**
     * Berekent VO2 Max en gerelateerde hartslagzones.
     * @param {object} params - Object met parameters.
     * @param {number} params.age - Leeftijd in jaren.
     * @param {number} params.height - Lengte in cm.
     * @param {number} params.weight - Gewicht in kg.
     * @param {number} params.maxWatt - Maximaal vermogen (bijv. op een ergometer).
     * @param {number} params.at - Anaerobe drempel hartslag.
     * @param {number} params.fatPercentage - Vetpercentage.
     * @param {string} params.gender - Geslacht ("male" of "female").
     */
    constructor({ age, height, weight, maxWatt, at, fatPercentage, gender }) {
        // Deze formules zijn vereenvoudigde voorbeelden en moeten mogelijk worden gevalideerd
        this.maximalOxygenUptake = Math.round((((260 - age) * height / 190) * 0.0113) + 0.395); // Voorbeeldformule
        this.vo2Standard = Math.round(maxWatt / (0.072 * weight)); // Voorbeeldformule
        this.vo2MaxPotential = Math.round(2 * this.maximalOxygenUptake * 1000 / weight * (1 - (fatPercentage / 100))); // Voorbeeldformule

        if (gender === "male") {
            this.theoreticalMax = Math.round(2 * this.maximalOxygenUptake * 1000 / (20.5 * Math.pow(height / 100, 2)));
        } else {
            this.theoreticalMax = Math.round(2 * this.maximalOxygenUptake * 1000 / (22.5 * Math.pow(height / 100, 2)));
        }

        // Hartslagzones gebaseerd op anaerobe drempel (AT)
        this.warmingUp = Math.round(at * 0.7);
        this.coolingDown = Math.round(at * 0.7 + 5);
        this.endurance1 = Math.round(at * 0.75);
        this.endurance2 = Math.round(at * 0.85);
        this.endurance3 = Math.round(at * 0.95);
        this.intensive1 = Math.round(at * 1.05);
        this.intensive2 = Math.round(at * 1.1);
    }
}

export class RuntimesVo2 {
    /**
     * Berekent geschatte hardlooptijden op basis van VO2 Max.
     * Gebruikt een vooraf gedefinieerde mapping.
     * @param {number} vo2max - De berekende VO2 Max waarde.
     */
    constructor(vo2max) {
        // Deze mapping is een vereenvoudigd voorbeeld. In de praktijk zou dit complexer zijn.
        const vo2ToRunTimesMap = new Map([
            [36, { "3k": 1143, "5k": 2039, "10k": 4514, "21k": 10785, "42k": 24674 }],
            [40, { "3k": 1026, "5k": 1819, "10k": 3988, "21k": 9399, "42k": 21133 }],
            [50, { "3k": 810, "5k": 1420, "10k": 3058, "21k": 7036, "42k": 15380 }],
            [60, { "3k": 662, "5k": 1152, "10k": 2451, "21k": 5555, "42k": 11938 }],
            [70, { "3k": 555, "5k": 961, "10k": 2027, "21k": 4545, "42k": 9656 }],
            [85, { "3k": 441, "5k": 759, "10k": 1587, "21k": 3521, "42k": 7397 }]
        ]);

        // Zoek de dichtstbijzijnde VO2 Max waarde in de mapping
        const vo2Keys = Array.from(vo2ToRunTimesMap.keys());
        const closestVo2 = vo2Keys.reduce((prev, curr) => Math.abs(curr - vo2max) < Math.abs(prev - vo2max) ? curr : prev);
        
        this.times = vo2ToRunTimesMap.get(closestVo2) || {};
    }
}
