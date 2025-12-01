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
        
        // Check if current path has finished
        const pathFinished = !this.currentPath || currentTime >= this.pathStartTime + this.currentPath.duration;
        
        if (pathFinished) {
            // Check if we're still in wait period
            if (currentTime < this.waitEndTime) {
                // Still waiting, return no movement
                return { dx: 0, dz: 0 };
            }
            
            // Wait period is over, plan new path
            this.currentPath = this.planNewPath(meteors, position, currentScore, aiLevel);
            this.pathStartTime = currentTime;
            this.pathEndTime = currentTime + this.currentPath.duration;
            
            // Calculate wait time: 500ms - (level × 50ms)
            // Level 1: 450ms wait, Level 10: 0ms wait
            const waitTimeMs = 500 - (aiLevel * 50);
            const waitTimeSec = Math.max(0, waitTimeMs) / 1000;
            this.waitEndTime = this.pathEndTime + waitTimeSec;
            
            // Debug: Log what we're returning
            if (Math.random() < 0.05) { // 5% of the time
                console.log(`[suggestMove] AI Level ${aiLevel}: New path dx=${this.currentPath.dx.toFixed(3)}, dz=${this.currentPath.dz.toFixed(3)}, duration=${this.currentPath.duration.toFixed(2)}s, wait=${waitTimeMs}ms`);
            }
        }
        
        // Follow the current path
        return { dx: this.currentPath.dx, dz: this.currentPath.dz };
    }

    /**
     * Plan a new path based on AI level
     */
    planNewPath(meteors, position, currentScore, aiLevel) {
        const skill = aiLevel / 10; // 0.1 to 1.0
        
        // Path duration: Lower skill = longer paths (0.8s to 0.3s)
        // Reduced from 1.5s because at 12 units/sec, long paths go out of bounds
        const pathDuration = 0.8 - skill * 0.5;
        
        // Lookahead percentage: Lower skill = worse prediction (30% to 90%)
        const lookaheadPercent = 0.3 + skill * 0.6;
        
        // Calculate meteor speed
        const baseMeteorSpeed = 8;
        const speedBoost = currentScore * 0.15;
        const meteorFallSpeed = baseMeteorSpeed + speedBoost;
        
        // Predict meteors with limited foresight
        const predictionTime = pathDuration * lookaheadPercent;
        const predictedMeteors = this.predictMeteorPositions(meteors, meteorFallSpeed, predictionTime);
        
        // Debug logging
        const debugLog = Math.random() < 0.1; // 10% of the time
        if (debugLog) {
            console.log(`\n=== AI LEVEL ${aiLevel} PLANNING ===`);
            console.log(`Position: (${position.x.toFixed(2)}, ${position.z.toFixed(2)})`);
            console.log(`Path duration: ${pathDuration.toFixed(2)}s`);
            console.log(`Lookahead: ${(lookaheadPercent*100).toFixed(0)}%`);
            console.log(`Prediction time: ${predictionTime.toFixed(2)}s`);
            console.log(`Meteors: ${meteors.length}, Predicted: ${predictedMeteors.length}`);
        }
        
        // Evaluate possible paths
        const directions = [
            { dx: 0, dz: 0, name: 'stay' },
            { dx: -1, dz: 0, name: 'left' },
            { dx: 1, dz: 0, name: 'right' },
            { dx: 0, dz: -1, name: 'forward' },
            { dx: 0, dz: 1, name: 'backward' },
            { dx: -0.707, dz: -0.707, name: 'left-forward' },
            { dx: 0.707, dz: -0.707, name: 'right-forward' },
            { dx: -0.707, dz: 0.707, name: 'left-backward' },
            { dx: 0.707, dz: 0.707, name: 'right-backward' }
        ];
        
        let bestPath = null;
        let bestScore = -Infinity;
        const allScores = [];
        
        for (const dir of directions) {
            const score = this.evaluatePath(dir, position, predictedMeteors, pathDuration, lookaheadPercent);
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
        if (debugLog && bestPath) {
            console.log(`\nAll direction scores:`);
            allScores.sort((a, b) => b.score - a.score).forEach((s, i) => {
                const marker = i === 0 ? '★' : ' ';
                console.log(`${marker} ${s.name.padEnd(15)}: ${s.score.toFixed(1)}`);
            });
            console.log(`\n→ CHOSE: ${bestPath.name} (dx=${bestPath.dx.toFixed(3)}, dz=${bestPath.dz.toFixed(3)})\n`);
        }
        
        return bestPath || { dx: 0, dz: 0, duration: pathDuration, score: 0 };
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
     * Evaluate a path by simulating movement along it
     */
    evaluatePath(direction, startPos, predictedMeteors, pathDuration, lookaheadPercent) {
        const playerSpeed = 12;
        const worldHalf = 9;
        
        // Calculate end position
        let endX = startPos.x + direction.dx * playerSpeed * pathDuration;
        let endZ = startPos.z + direction.dz * playerSpeed * pathDuration;
        
        // Instead of rejecting out-of-bounds paths, heavily penalize them
        // but still evaluate them (the game will clamp anyway)
        let boundsPenalty = 0;
        
        if (Math.abs(endX) > worldHalf - 1) {
            boundsPenalty += 500 * (Math.abs(endX) - (worldHalf - 1));
        }
        if (Math.abs(endZ) > worldHalf - 1) {
            boundsPenalty += 500 * (Math.abs(endZ) - (worldHalf - 1));
        }
        
        // Clamp for evaluation purposes
        endX = Math.max(-worldHalf + 1, Math.min(worldHalf - 1, endX));
        endZ = Math.max(-worldHalf + 1, Math.min(worldHalf - 1, endZ));
        
        let score = 0;
        const numSamples = 8; // Check 8 points along the path
        
        // Base bonus for any non-zero movement (encourages action)
        if (direction.dx !== 0 || direction.dz !== 0) {
            score += 30;
        }
        
        // Simulate movement along the path
        for (let i = 0; i <= numSamples; i++) {
            const t = (i / numSamples) * pathDuration;
            const playerX = startPos.x + direction.dx * playerSpeed * t;
            const playerZ = startPos.z + direction.dz * playerSpeed * t;
            
            // Check against meteors at this time
            let minDist = Infinity;
            
            for (const meteor of predictedMeteors) {
                // Where is this meteor at time t?
                // We can only predict accurately up to predictionTime (pathDuration × lookaheadPercent)
                const effectiveT = Math.min(t, meteor.predictionTime);
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
        }
        
        // Prefer center of platform (but not too strong)
        const centerDist = Math.sqrt(endX * endX + endZ * endZ);
        score -= centerDist * 2;
        
        // Strong penalty for being near edges
        const edgeDistX = worldHalf - Math.abs(endX);
        const edgeDistZ = worldHalf - Math.abs(endZ);
        const minEdgeDist = Math.min(edgeDistX, edgeDistZ);
        if (minEdgeDist < 2) {
            score -= 150 * (2 - minEdgeDist);
        }
        
        // Penalty for staying still when there are threats
        if (direction.dx === 0 && direction.dz === 0) {
            // Count threats that are relatively close
            const nearbyThreats = predictedMeteors.filter(m => {
                const dist = Math.sqrt(
                    Math.pow(startPos.x - m.currentX, 2) +
                    Math.pow(startPos.z - m.currentZ, 2)
                );
                return dist < 6 && Math.abs(m.currentY - 1) < 5;
            }).length;
            
            if (nearbyThreats > 0) {
                score -= 50 * Math.min(nearbyThreats, 5);
            } else {
                score -= 10; // Small penalty even with no threats
            }
        }
        
        // Apply bounds penalty
        score -= boundsPenalty;
        
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
}

// For backward compatibility, export functions that use a singleton instance
const defaultAI = new ComputerAI();

function suggestMove(meteors, position, currentScore = 0, aiLevel = 5) {
    return defaultAI.suggestMove(meteors, position, currentScore, aiLevel);
}

function resetAI() {
    defaultAI.reset();
}
