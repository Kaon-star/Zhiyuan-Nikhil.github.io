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
    }

    /**
     * Main AI function - plans and follows paths
     * @param {Array} meteors - Array of meteor objects with position and velocity
     * @param {Object} position - Current player position {x, y, z}
     * @param {Number} currentScore - Current game score
     * @param {Number} aiLevel - AI difficulty level (1-10)
     * @returns {Object} - Movement direction {dx, dz}
     */
    suggestMove(meteors, position, currentScore = 0, aiLevel = 5) {
        const currentTime = Date.now() / 1000;
        
        if (this.shouldPlanNewPath(currentTime)) {
            if (this.isInWaitPeriod(currentTime)) {
                return { dx: 0, dz: 0 };
            }
            
            this.planAndStartNewPath(meteors, position, currentScore, aiLevel, currentTime);
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
    planAndStartNewPath(meteors, position, currentScore, aiLevel, currentTime) {
        this.currentPath = this.planNewPath(meteors, position, currentScore, aiLevel);
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
    planNewPath(meteors, position, currentScore, aiLevel) {
        const skill = this.calculateSkillFromLevel(aiLevel);
        const pathDuration = this.calculatePathDuration(skill);
        const lookaheadPercent = this.calculateLookaheadPercent(skill);
        const meteorFallSpeed = this.calculateMeteorSpeed(currentScore);
        const predictionTime = pathDuration * lookaheadPercent;
        const predictedMeteors = this.predictMeteorPositions(meteors, meteorFallSpeed, predictionTime);
        
        this.logPlanningDebug(aiLevel, position, pathDuration, lookaheadPercent, predictionTime, meteors, predictedMeteors);
        
        const directions = this.getAllPossibleDirections();
        const bestPath = this.selectBestPath(directions, position, predictedMeteors, pathDuration, lookaheadPercent, aiLevel);
        
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
        return 0.8 - skill * 0.5;
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
    selectBestPath(directions, position, predictedMeteors, pathDuration, lookaheadPercent, aiLevel) {
        let bestPath = null;
        let bestScore = -Infinity;
        const allScores = [];
        
        for (const dir of directions) {
            const score = this.evaluatePath(dir, position, predictedMeteors, pathDuration, lookaheadPercent, aiLevel);
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
     * Decision: Does the path cross or end inside any platform hole?
     * Returns true if the simulated movement along the direction would cross or end inside any platform hole.
     * This checks the AI's movement path to avoid falling through holes.
     */
    pathContainsHole(direction, startPos, predictedMeteors, pathDuration, lookaheadPercent) {
        // If hole avoidance is disabled, we never treat paths through holes as bad.
        if (!this.enableHoleAvoidance) {
            return false;
        }
        
        const holeSpecs = this.getHoleSpecifications();
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
     * Decision: Get the specifications of all platform holes
     */
    getHoleSpecifications() {
        return [
            { x: -6, z: 6, halfSize: 2.5 },
            { x: 8,  z: -2, halfSize: 2.2 },
            { x: 0,  z: -8, halfSize: 3.0 }
        ];
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
    evaluatePath(direction, startPos, predictedMeteors, pathDuration, lookaheadPercent, aiLevel) {
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
        score += this.scoreCenterPreference(endX, endZ);
        score += this.scoreEdgeAvoidance(endX, endZ, worldHalf);
        score += this.scoreStillnessPenalty(direction, startPos, predictedMeteors);
        score += this.scoreHolePenalty(direction, startPos, predictedMeteors, pathDuration, lookaheadPercent, aiLevel);
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
    scoreHolePenalty(direction, startPos, predictedMeteors, pathDuration, lookaheadPercent, aiLevel) {
        if (this.pathContainsHole(direction, startPos, predictedMeteors, pathDuration, lookaheadPercent)) {
            return -20 * aiLevel;
        }
        return 0;
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
}

// For backward compatibility, export functions that use a singleton instance
const defaultAI = new ComputerAI();

function suggestMove(meteors, position, currentScore = 0, aiLevel = 5) {
    return defaultAI.suggestMove(meteors, position, currentScore, aiLevel);
}

function resetAI() {
    defaultAI.reset();
}
