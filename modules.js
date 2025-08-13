// Bestand: modules.js
// Bevat herbruikbare klassen voor lichaamsberekeningen en fysiologische modellen.

export class Bodystandard {
    constructor({ gender, age, weight, height, fatPercentage }) {
        this.LBM = Math.round(weight - (weight * (fatPercentage / 100)));
        this.fatMass = Math.round(weight * fatPercentage / 100);
        this.muscleMass = Math.round(this.LBM * 0.45);
        this.bmi = Math.round(weight / ((height / 100) * (height / 100)));
        this.idealWeightBMI = Math.round((height / 100) * (height / 100) * 22.5);

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
    constructor({ age, height, weight, maxWatt, at, fatPercentage, gender }) {
        this.maximalOxygenUptake = Math.round((((260 - age) * height / 190) * 0.0113) + 0.395);
        this.vo2Standard = Math.round(maxWatt / (0.072 * weight));
        this.vo2MaxPotential = Math.round(2 * this.maximalOxygenUptake * 1000 / weight * (1 - (fatPercentage / 100)));

        if (gender === "male") {
            this.theoreticalMax = Math.round(2 * this.maximalOxygenUptake * 1000 / (20.5 * Math.pow(height / 100, 2)));
        } else {
            this.theoreticalMax = Math.round(2 * this.maximalOxygenUptake * 1000 / (22.5 * Math.pow(height / 100, 2)));
        }

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
    constructor(vo2max) {
        const vo2ToRunTimesMap = new Map([
            [36, { "3k": 1143, "5k": 2039, "10k": 4514, "21k": 10785, "42k": 24674 }],
            [40, { "3k": 1026, "5k": 1819, "10k": 3988, "21k": 9399, "42k": 21133 }],
            [50, { "3k": 810, "5k": 1420, "10k": 3058, "21k": 7036, "42k": 15380 }],
            [60, { "3k": 662, "5k": 1152, "10k": 2451, "21k": 5555, "42k": 11938 }],
            [70, { "3k": 555, "5k": 961, "10k": 2027, "21k": 4545, "42k": 9656 }],
            [85, { "3k": 441, "5k": 759, "10k": 1587, "21k": 3521, "42k": 7397 }]
        ]);
        const vo2Keys = Array.from(vo2ToRunTimesMap.keys());
        const closestVo2 = vo2Keys.reduce((prev, curr) => Math.abs(curr - vo2max) < Math.abs(prev - vo2max) ? curr : prev);
        this.times = vo2ToRunTimesMap.get(closestVo2) || {};
    }
}
