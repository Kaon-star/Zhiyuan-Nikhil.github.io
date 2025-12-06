/**
 * Path-based AI with difficulty levels
 * Lower levels: Long paths with poor meteor prediction
 * Higher levels: Short paths with good meteor prediction
 */

class ComputerAI {
    constructor() {
        this.currentPath = null;
        this.pathStartTime = 0;
        this.pathEndTime = 0; // When the current path finishes
        this.waitEndTime = 0; // When the wait period finishes
        this.enableHoleAvoidance = true;
        this.enableThinkingTime = true;
        this.enableEnemyAvoidance = true;
        this.minEnemyDistance = 5.0; // Minimum safe distance from enemies (units)
    }

    /**
     * Main AI function - plans and follows paths
     * @param {Array} meteors - Array of meteor objects with position and velocity
     * @param {Object} position - Current player position {x, y, z}
     * @param {Number} currentScore - Current game score
     * @param {Number} aiLevel - AI difficulty level (1-10)
     * @param {Array} enemies - Array of enemy objects with position (optional)
     * @param {Array} holes - Array of hole objects with {x, z, halfSize} (optional)
     * @returns {Object} - Movement direction {dx, dz}
     */
    suggestMove(meteors, position, currentScore = 0, aiLevel = 5, enemies = [], holes = []) {
        const currentTime = Date.now() / 1000;
        
        if (this.shouldPlanNewPath(currentTime)) {
            if (this.isInWaitPeriod(currentTime)) {
                return { dx: 0, dz: 0 };
            }
            
            this.planAndStartNewPath(meteors, position, currentScore, aiLevel, currentTime, enemies, holes);
        }
        
        return this.getCurrentPathDirection();
    }

    /**
     * Decision: Should we plan a new path?
     */
    shouldPlanNewPath(currentTime) {
        return !this.currentPath || currentTime >= this.pathStartTime + this.currentPath.duration;
    }

    /**
     * Decision: Are we still in the wait period?
     */
    isInWaitPeriod(currentTime) {
        return currentTime < this.waitEndTime;
    }

    /**
     * Action: Plan a new path and start following it
     */
    planAndStartNewPath(meteors, position, currentScore, aiLevel, currentTime, enemies = [], holes = []) {
        this.currentPath = this.planNewPath(meteors, position, currentScore, aiLevel, enemies, holes);
        this.pathStartTime = currentTime;
        this.pathEndTime = currentTime + this.currentPath.duration;
        
        const waitTimeMs = this.calculateWaitTime(aiLevel);
        const waitTimeSec = Math.max(0, waitTimeMs) / 1000;
        this.waitEndTime = this.pathEndTime + waitTimeSec;
        
        // Debug: Log what we're returning
        if (Math.random() < 0.05) { // 5% of the time
            console.log(`[suggestMove] AI Level ${aiLevel}: New path dx=${this.currentPath.dx.toFixed(3)}, dz=${this.currentPath.dz.toFixed(3)}, duration=${this.currentPath.duration.toFixed(2)}s, wait=${waitTimeMs}ms`);
        }
    }

    /**
     * Decision: Calculate wait time between paths based on AI level
     */
    calculateWaitTime(aiLevel) {
        // Calculate wait time: 500ms - (level × 50ms)
        // Level 1: 450ms wait, Level 10: 0ms wait
        // If thinking time is disabled, there is no forced wait.
        return this.enableThinkingTime ? (500 - (aiLevel * 50)) : 0;
    }

    /**
     * Action: Get the current path's movement direction
     */
    getCurrentPathDirection() {
        return { dx: this.currentPath.dx, dz: this.currentPath.dz };
    }

    /**
     * Plan a new path based on AI level
     */
    planNewPath(meteors, position, currentScore, aiLevel, enemies = [], holes = []) {
        const skill = this.calculateSkillFromLevel(aiLevel);
        const pathDuration = this.calculatePathDuration(skill);
        const lookaheadPercent = this.calculateLookaheadPercent(skill);
        const meteorFallSpeed = this.calculateMeteorSpeed(currentScore);
        const predictionTime = pathDuration * lookaheadPercent;
        const predictedMeteors = this.predictMeteorPositions(meteors, meteorFallSpeed, predictionTime);
        const predictedEnemies = this.predictEnemyPositions(enemies, position, pathDuration);
        
        this.logPlanningDebug(aiLevel, position, pathDuration, lookaheadPercent, predictionTime, meteors, predictedMeteors);
        
        const directions = this.getAllPossibleDirections();
        const bestPath = this.selectBestPath(directions, position, predictedMeteors, pathDuration, lookaheadPercent, aiLevel, predictedEnemies, holes);
        
        return bestPath || { dx: 0, dz: 0, duration: pathDuration, score: 0 };
    }

    /**
     * Decision: Calculate skill level from AI level (0.1 to 1.0)
     */
    calculateSkillFromLevel(aiLevel) {
        return aiLevel / 10;
    }

    /**
     * Decision: Calculate path duration based on skill
     * Lower skill = longer paths (0.8s to 0.3s)
     */
    calculatePathDuration(skill) {
        // Reduced from 1.5s because at 12 units/sec, long paths go out of bounds
        return 1.6 - skill * 1.0;
    }

    /**
     * Decision: Calculate lookahead percentage based on skill
     * Lower skill = worse prediction (30% to 90%)
     */
    calculateLookaheadPercent(skill) {
        return 0.3 + skill * 0.6;
    }

    /**
     * Decision: Calculate meteor fall speed based on current score
     */
    calculateMeteorSpeed(currentScore) {
        const baseMeteorSpeed = 8;
        const speedBoost = currentScore * 0.15;
        return baseMeteorSpeed + speedBoost;
    }

    /**
     * Action: Get all possible movement directions
     */
    getAllPossibleDirections() {
        const sqrt22 = Math.sqrt(2) / 2;
        
        return [
            { dx: 0, dz: 0, name: 'stay' },
            { dx: -1, dz: 0, name: 'left' },
            { dx: 1, dz: 0, name: 'right' },
            { dx: 0, dz: -1, name: 'forward' },
            { dx: 0, dz: 1, name: 'backward' },
            { dx: -sqrt22, dz: -sqrt22, name: 'left-forward' },
            { dx: sqrt22, dz: -sqrt22, name: 'right-forward' },
            { dx: -sqrt22, dz: sqrt22, name: 'left-backward' },
            { dx: sqrt22, dz: sqrt22, name: 'right-backward' }
        ];
    }

    /**
     * Decision: Select the best path from all possible directions
     */
    selectBestPath(directions, position, predictedMeteors, pathDuration, lookaheadPercent, aiLevel, predictedEnemies = [], holes = []) {
        let bestPath = null;
        let bestScore = -Infinity;
        const allScores = [];
        
        for (const dir of directions) {
            const score = this.evaluatePath(dir, position, predictedMeteors, pathDuration, lookaheadPercent, aiLevel, predictedEnemies, holes);
            allScores.push({ name: dir.name, score: score });
            
            if (score > bestScore) {
                bestScore = score;
                bestPath = {
                    dx: dir.dx,
                    dz: dir.dz,
                    duration: pathDuration,
                    score: score,
                    name: dir.name
                };
            }
        }
        
        // Debug logging
        const debugLog = Math.random() < 0.1; // 10% of the time
        if (debugLog && bestPath) {
            console.log(`\nAll direction scores:`);
            allScores.sort((a, b) => b.score - a.score).forEach((s, i) => {
                const marker = i === 0 ? '★' : ' ';
                console.log(`${marker} ${s.name.padEnd(15)}: ${s.score.toFixed(1)}`);
            });
            console.log(`\n→ CHOSE: ${bestPath.name} (dx=${bestPath.dx.toFixed(3)}, dz=${bestPath.dz.toFixed(3)})\n`);
        }
        
        return bestPath;
    }

    /**
     * Action: Log planning debug information
     */
    logPlanningDebug(aiLevel, position, pathDuration, lookaheadPercent, predictionTime, meteors, predictedMeteors) {
        const debugLog = Math.random() < 0.1; // 10% of the time
        if (debugLog) {
            console.log(`\n=== AI LEVEL ${aiLevel} PLANNING ===`);
            console.log(`Position: (${position.x.toFixed(2)}, ${position.z.toFixed(2)})`);
            console.log(`Path duration: ${pathDuration.toFixed(2)}s`);
            console.log(`Lookahead: ${(lookaheadPercent*100).toFixed(0)}%`);
            console.log(`Prediction time: ${predictionTime.toFixed(2)}s`);
            console.log(`Meteors: ${meteors.length}, Predicted: ${predictedMeteors.length}`);
        }
    }

    /**
     * Predict where meteors will be
     */
    predictMeteorPositions(meteors, meteorSpeed, predictionTime) {
        return meteors.map(m => {
            const velocity = m.velocity || { x: 0, y: -meteorSpeed, z: 0 };
            
            return {
                currentX: m.position.x,
                currentY: m.position.y,
                currentZ: m.position.z,
                velocity: velocity,
                predictionTime: predictionTime
            };
        });
    }

    /**
     * Predict where enemies will be (they chase the player)
     * Enemies move toward the player, so we predict based on their current position and direction to player
     */
    predictEnemyPositions(enemies, playerPosition, pathDuration) {
        if (!this.enableEnemyAvoidance || !enemies || enemies.length === 0) {
            return [];
        }

        // Estimate enemy speed (similar to how the game calculates it)
        // This is a rough estimate - in the actual game, enemy speed varies with score
        const estimatedEnemySpeed = 2.6; // Base speed, will be adjusted based on game state
        
        return enemies.map(e => {
            if (!e || !e.position) return null;
            
            const dx = playerPosition.x - e.position.x;
            const dz = playerPosition.z - e.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            
            // If enemy is very close or at same position, don't predict movement
            if (dist < 0.001) {
                return {
                    currentX: e.position.x,
                    currentY: e.position.y || 0.6,
                    currentZ: e.position.z,
                    velocity: { x: 0, y: 0, z: 0 },
                    predictionTime: pathDuration
                };
            }
            
            // Normalize direction and apply speed
            const normalizedDx = dx / dist;
            const normalizedDz = dz / dist;
            
            return {
                currentX: e.position.x,
                currentY: e.position.y || 0.6,
                currentZ: e.position.z,
                velocity: { 
                    x: normalizedDx * estimatedEnemySpeed, 
                    y: 0, 
                    z: normalizedDz * estimatedEnemySpeed 
                },
                predictionTime: pathDuration
            };
        }).filter(e => e !== null);
    }

    /**
     * Decision: Does the path cross or end inside any platform hole?
     * Returns true if the simulated movement along the direction would cross or end inside any platform hole.
     * This checks the AI's movement path to avoid falling through holes.
     */
    pathContainsHole(direction, startPos, predictedMeteors, pathDuration, lookaheadPercent, holes = []) {
        // If hole avoidance is disabled, we never treat paths through holes as bad.
        if (!this.enableHoleAvoidance) {
            return false;
        }
        
        // Use dynamic holes if provided, otherwise fall back to empty array
        const holeSpecs = holes.length > 0 ? holes : [];
        const playerSpeed = 12;
        const numSamples = 10;

        // We'll check points along the path, including the start and end.
        for (let i = 0; i <= numSamples; i++) {
            const t = (i / numSamples) * pathDuration;
            const position = this.calculatePositionAlongPath(startPos, direction, playerSpeed, t);
            
            if (this.isPositionInAnyHole(position, holeSpecs)) {
                return true; // Path crosses or ends inside this hole.
            }
        }
        return false;
    }

    /**
     * Action: Calculate position along a path at a given time
     */
    calculatePositionAlongPath(startPos, direction, playerSpeed, time) {
        return {
            x: startPos.x + direction.dx * playerSpeed * time,
            z: startPos.z + direction.dz * playerSpeed * time
        };
    }

    /**
     * Decision: Is a position inside any hole?
     */
    isPositionInAnyHole(position, holeSpecs) {
        for (const hole of holeSpecs) {
            if (this.isPositionInHole(position, hole)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Decision: Is a position inside a specific hole?
     */
    isPositionInHole(position, hole) {
        return (
            position.x >= (hole.x - hole.halfSize) &&
            position.x <= (hole.x + hole.halfSize) &&
            position.z >= (hole.z - hole.halfSize) &&
            position.z <= (hole.z + hole.halfSize)
        );
    }

    /**
     * Evaluate a path by simulating movement along it
     */
    evaluatePath(direction, startPos, predictedMeteors, pathDuration, lookaheadPercent, aiLevel, predictedEnemies = [], holes = []) {
        const playerSpeed = 12;
        const worldHalf = 9;
        
        // Calculate end position
        let endX = startPos.x + direction.dx * playerSpeed * pathDuration;
        let endZ = startPos.z + direction.dz * playerSpeed * pathDuration;
        
        const boundsPenalty = this.calculateBoundsPenalty(endX, endZ, worldHalf);
        
        // Clamp for evaluation purposes
        endX = Math.max(-worldHalf + 1, Math.min(worldHalf - 1, endX));
        endZ = Math.max(-worldHalf + 1, Math.min(worldHalf - 1, endZ));
        
        let score = 0;
        
        // Score different aspects of the path
        score += this.scoreMovementBonus(direction);
        score += this.scoreMeteorCollisions(direction, startPos, predictedMeteors, pathDuration, playerSpeed);
        score += this.scoreEnemyCollisions(direction, startPos, predictedEnemies, pathDuration, playerSpeed);
        score += this.scoreCenterPreference(endX, endZ);
        score += this.scoreEdgeAvoidance(endX, endZ, worldHalf);
        score += this.scoreStillnessPenalty(direction, startPos, predictedMeteors);
        score += this.scoreHolePenalty(direction, startPos, predictedMeteors, pathDuration, lookaheadPercent, aiLevel, holes);
        score -= boundsPenalty;
        
        return score;
    }

    /**
     * Decision: Calculate penalty for going out of bounds
     */
    calculateBoundsPenalty(endX, endZ, worldHalf) {
        let boundsPenalty = 0;
        
        // Instead of rejecting out-of-bounds paths, heavily penalize them
        // but still evaluate them (the game will clamp anyway)
        if (Math.abs(endX) > worldHalf - 1) {
            boundsPenalty += 500 * (Math.abs(endX) - (worldHalf - 1));
        }
        if (Math.abs(endZ) > worldHalf - 1) {
            boundsPenalty += 500 * (Math.abs(endZ) - (worldHalf - 1));
        }
        
        return boundsPenalty;
    }

    /**
     * Decision: Score bonus for any non-zero movement (encourages action)
     */
    scoreMovementBonus(direction) {
        if (direction.dx !== 0 || direction.dz !== 0) {
            return 30;
        }
        return 0;
    }

    /**
     * Decision: Score meteor collision risks along the path
     */
    scoreMeteorCollisions(direction, startPos, predictedMeteors, pathDuration, playerSpeed) {
        let score = 0;
        const numSamples = 8; // Check 8 points along the path
        
        // Simulate movement along the path
        for (let i = 0; i <= numSamples; i++) {
            const t = (i / numSamples) * pathDuration;
            const playerX = startPos.x + direction.dx * playerSpeed * t;
            const playerZ = startPos.z + direction.dz * playerSpeed * t;
            
            const collisionScore = this.scoreMeteorCollisionAtPoint(playerX, playerZ, t, predictedMeteors);
            score += collisionScore;
        }
        
        return score;
    }

    /**
     * Decision: Score meteor collision risk at a specific point in time
     */
    scoreMeteorCollisionAtPoint(playerX, playerZ, time, predictedMeteors) {
        let score = 0;
        let minDist = Infinity;
        
        for (const meteor of predictedMeteors) {
            // Where is this meteor at time t?
            // We can only predict accurately up to predictionTime (pathDuration × lookaheadPercent)
            const effectiveT = Math.min(time, meteor.predictionTime);
            const meteorX = meteor.currentX + meteor.velocity.x * effectiveT;
            const meteorY = meteor.currentY + meteor.velocity.y * effectiveT;
            const meteorZ = meteor.currentZ + meteor.velocity.z * effectiveT;
            
            // Only consider meteors near player height
            if (Math.abs(meteorY - 1) < 4) {
                const dist = Math.sqrt(
                    Math.pow(playerX - meteorX, 2) +
                    Math.pow(playerZ - meteorZ, 2)
                );
                
                minDist = Math.min(minDist, dist);
                
                // Height urgency - more dangerous when at player level
                const heightFactor = Math.max(0, 1 - Math.abs(meteorY - 1) / 2);
                
                // Collision zone
                if (dist < 1.6) {
                    score -= 1000 * heightFactor;
                }
                // Danger zone
                else if (dist < 3.5) {
                    score -= 200 * heightFactor / Math.max(dist, 0.5);
                }
                // Warning zone
                else if (dist < 5) {
                    score -= 30 * heightFactor / dist;
                }
            }
        }
        
        // Reward maintaining safe distance
        if (minDist < Infinity) {
            score += Math.min(minDist * 5, 50);
        }
        
        return score;
    }

    /**
     * Decision: Score preference for being near center of platform
     */
    scoreCenterPreference(endX, endZ) {
        const centerDist = Math.sqrt(endX * endX + endZ * endZ);
        return -centerDist * 2; // Prefer center (but not too strong)
    }

    /**
     * Decision: Score penalty for being near edges
     */
    scoreEdgeAvoidance(endX, endZ, worldHalf) {
        const edgeDistX = worldHalf - Math.abs(endX);
        const edgeDistZ = worldHalf - Math.abs(endZ);
        const minEdgeDist = Math.min(edgeDistX, edgeDistZ);
        
        if (minEdgeDist < 2) {
            return -150 * (2 - minEdgeDist); // Strong penalty for being near edges
        }
        return 0;
    }

    /**
     * Decision: Score penalty for staying still when there are threats
     */
    scoreStillnessPenalty(direction, startPos, predictedMeteors) {
        if (direction.dx === 0 && direction.dz === 0) {
            // Count threats that are relatively close
            const nearbyThreats = this.countNearbyThreats(startPos, predictedMeteors);
            
            if (nearbyThreats > 0) {
                return -50 * Math.min(nearbyThreats, 5);
            } else {
                return -10; // Small penalty even with no threats
            }
        }
        return 0;
    }

    /**
     * Decision: Count nearby threats to the player
     */
    countNearbyThreats(startPos, predictedMeteors) {
        return predictedMeteors.filter(m => {
            const dist = Math.sqrt(
                Math.pow(startPos.x - m.currentX, 2) +
                Math.pow(startPos.z - m.currentZ, 2)
            );
            return dist < 6 && Math.abs(m.currentY - 1) < 5;
        }).length;
    }

    /**
     * Decision: Score penalty for paths that go through holes
     */
    scoreHolePenalty(direction, startPos, predictedMeteors, pathDuration, lookaheadPercent, aiLevel, holes = []) {
        if (this.pathContainsHole(direction, startPos, predictedMeteors, pathDuration, lookaheadPercent, holes)) {
            return -20 * aiLevel;
        }
        return 0;
    }

    /**
     * Decision: Score enemy collision risks along the path
     */
    scoreEnemyCollisions(direction, startPos, predictedEnemies, pathDuration, playerSpeed) {
        if (!this.enableEnemyAvoidance || !predictedEnemies || predictedEnemies.length === 0) {
            return 0;
        }

        let score = 0;
        const numSamples = 8; // Check 8 points along the path
        
        // Simulate movement along the path
        for (let i = 0; i <= numSamples; i++) {
            const t = (i / numSamples) * pathDuration;
            const playerX = startPos.x + direction.dx * playerSpeed * t;
            const playerZ = startPos.z + direction.dz * playerSpeed * t;
            
            const collisionScore = this.scoreEnemyCollisionAtPoint(playerX, playerZ, t, predictedEnemies, startPos);
            score += collisionScore;
        }
        
        return score;
    }

    /**
     * Decision: Score enemy collision risk at a specific point in time
     */
    scoreEnemyCollisionAtPoint(playerX, playerZ, time, predictedEnemies, playerStartPos) {
        if (!this.enableEnemyAvoidance || !predictedEnemies || predictedEnemies.length === 0) {
            return 0;
        }

        let score = 0;
        let minDist = Infinity;
        let closestEnemyAtTime = null;
        
        // Find the closest enemy at this point in time
        for (const enemy of predictedEnemies) {
            // Where is this enemy at time t?
            const effectiveT = Math.min(time, enemy.predictionTime);
            const enemyX = enemy.currentX + enemy.velocity.x * effectiveT;
            const enemyY = enemy.currentY + enemy.velocity.y * effectiveT;
            const enemyZ = enemy.currentZ + enemy.velocity.z * effectiveT;
            
            // Enemies are on the ground, so we check horizontal distance
            const dist = Math.sqrt(
                Math.pow(playerX - enemyX, 2) +
                Math.pow(playerZ - enemyZ, 2)
            );
            
            if (dist < minDist) {
                minDist = dist;
                closestEnemyAtTime = { x: enemyX, z: enemyZ, dist: dist };
            }
            
            // Collision zone - enemies are dangerous when very close
            if (dist < 2.0) {
                score -= 1500; // Very strong penalty for being too close to enemies
            }
            // Danger zone
            else if (dist < 4.0) {
                score -= 400 / Math.max(dist, 0.5); // Strong penalty
            }
            // Warning zone
            else if (dist < 6.0) {
                score -= 50 / dist; // Moderate penalty
            }
            // Caution zone
            else if (dist < 8.0) {
                score -= 10 / dist; // Light penalty
            }
        }
        
        // Active minimum distance maintenance
        if (minDist < Infinity && closestEnemyAtTime && playerStartPos) {
            // Find the closest enemy at the start position to compare distance change
            let closestEnemyAtStart = null;
            let startDist = Infinity;
            
            for (const enemy of predictedEnemies) {
                const startDistToEnemy = Math.sqrt(
                    Math.pow(playerStartPos.x - enemy.currentX, 2) +
                    Math.pow(playerStartPos.z - enemy.currentZ, 2)
                );
                if (startDistToEnemy < startDist) {
                    startDist = startDistToEnemy;
                    closestEnemyAtStart = { x: enemy.currentX, z: enemy.currentZ };
                }
            }
            
            if (minDist < this.minEnemyDistance) {
                // Below minimum distance - strongly penalize
                const distanceBelow = this.minEnemyDistance - minDist;
                score -= 300 * distanceBelow; // Strong penalty for being below minimum
                
                // Check if this path moves away from the closest enemy
                if (closestEnemyAtStart && startDist < Infinity) {
                    if (minDist > startDist) {
                        // Moving away - bonus
                        score += 150 * (minDist - startDist);
                    } else if (minDist < startDist) {
                        // Moving closer - extra penalty
                        score -= 200 * (startDist - minDist);
                    }
                }
            } else {
                // Above minimum distance - reward maintaining safe distance
                const distanceAbove = minDist - this.minEnemyDistance;
                score += 40 * Math.min(distanceAbove, 5); // Bonus for maintaining safe distance (capped)
                
                // Extra bonus if we're well above minimum
                if (distanceAbove > 2.0) {
                    score += 30; // Additional bonus for being well above minimum
                }
                
                // Bonus for increasing distance when already safe
                if (closestEnemyAtStart && startDist < Infinity && minDist > startDist) {
                    score += 20 * Math.min(minDist - startDist, 3); // Small bonus for increasing distance
                }
            }
        }
        
        return score;
    }

    /**
     * Reset the AI state (call when game restarts)
     */
    reset() {
        this.currentPath = null;
        this.pathStartTime = 0;
        this.pathEndTime = 0;
        this.waitEndTime = 0;
    }

    /**
     * Enable or disable hole avoidance behavior.
     */
    setHoleAvoidanceEnabled(enabled) {
        this.enableHoleAvoidance = !!enabled;
    }

    /**
     * Enable or disable thinking-time (pause) between paths.
     */
    setThinkingTimeEnabled(enabled) {
        this.enableThinkingTime = !!enabled;
    }

    /**
     * Enable or disable enemy avoidance behavior.
     */
    setEnemyAvoidanceEnabled(enabled) {
        this.enableEnemyAvoidance = !!enabled;
    }
}

// For backward compatibility, export functions that use a singleton instance
const defaultAI = new ComputerAI();

function suggestMove(meteors, position, currentScore = 0, aiLevel = 5, enemies = [], holes = []) {
    return defaultAI.suggestMove(meteors, position, currentScore, aiLevel, enemies, holes);
}

function resetAI() {
    defaultAI.reset();
}
