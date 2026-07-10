/**
 * WaveSystem - 竖版塔防波次调度器
 * 只负责生成波次、控制刷怪节奏和判断波次结束。
 */

export class WaveSystem {
    constructor(options = {}) {
        this.totalWaves = options.totalWaves || 10;
        this.reset();
    }

    reset() {
        this.currentWave = 0;
        this.phase = 'ready';
        this.spawnQueue = [];
        this.spawnInterval = 900;
        this.spawnTimer = 0;
    }

    canStartNextWave() {
        return (
            (this.phase === 'ready' || this.phase === 'intermission') &&
            this.currentWave < this.totalWaves
        );
    }

    startNextWave() {
        if (!this.canStartNextWave()) {
            return { success: false, message: '当前不能开始下一波' };
        }

        this.currentWave += 1;
        const plan = this.buildWavePlan(this.currentWave);
        this.spawnQueue = [...plan.enemies];
        this.spawnInterval = plan.spawnInterval;
        // 第一只怪物在下一次更新时立即出现。
        this.spawnTimer = this.spawnInterval;
        this.phase = 'spawning';

        return {
            success: true,
            wave: this.currentWave,
            enemyCount: this.spawnQueue.length,
            message: `第 ${this.currentWave} 波开始`
        };
    }

    buildWavePlan(waveNumber) {
        const wave = Math.max(1, Math.min(this.totalWaves, waveNumber));
        const available = this.getAvailableTemplates(wave);
        const normalCount = wave === this.totalWaves ? 12 : 5 + wave * 2;
        const enemies = [];

        for (let index = 0; index < normalCount; index += 1) {
            const templateId = available[(index + wave) % available.length];
            enemies.push({
                templateId,
                elite: wave >= 5 && index === normalCount - 1 && wave % 5 === 0
            });
        }

        if (wave === this.totalWaves) {
            enemies.push({ templateId: 'dragon', elite: true, boss: true });
        }

        return {
            enemies,
            spawnInterval: Math.max(430, 920 - wave * 45)
        };
    }

    getAvailableTemplates(wave) {
        if (wave <= 2) return ['slime', 'goblin'];
        if (wave <= 4) return ['slime', 'goblin', 'bat'];
        if (wave <= 6) return ['goblin', 'bat', 'skeleton'];
        if (wave <= 8) return ['bat', 'skeleton', 'demon'];
        return ['skeleton', 'goblin', 'demon', 'bat'];
    }

    update(deltaTime, spawnEnemy, aliveEnemyCount) {
        const event = {
            spawned: 0,
            waveCompleted: false,
            victory: false
        };

        if (this.phase !== 'spawning' && this.phase !== 'combat') {
            return event;
        }

        if (this.phase === 'spawning') {
            this.spawnTimer += Math.max(0, deltaTime);

            while (this.spawnQueue.length > 0 && this.spawnTimer >= this.spawnInterval) {
                this.spawnTimer -= this.spawnInterval;
                const nextEnemy = this.spawnQueue.shift();
                spawnEnemy(nextEnemy, this.currentWave);
                event.spawned += 1;
            }

            if (this.spawnQueue.length === 0) {
                this.phase = 'combat';
            }
        }

        const effectiveAliveCount = aliveEnemyCount + event.spawned;
        if (this.phase === 'combat' && this.spawnQueue.length === 0 && effectiveAliveCount === 0) {
            event.waveCompleted = true;
            event.victory = this.currentWave >= this.totalWaves;
            this.phase = event.victory ? 'victory' : 'intermission';
        }

        return event;
    }

    getRemainingSpawnCount() {
        return this.spawnQueue.length;
    }

    getSaveData() {
        // 局内波次不进入存档，离开后从完整的一局重新开始。
        return {
            totalWaves: this.totalWaves
        };
    }
}
