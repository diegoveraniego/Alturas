export function generateDefaultTown() {
    const blocks = [];
    const addWall = (x, z, color, isHalf=false) => blocks.push({x, y: isHalf?0.25:0.5, z, color, isHalf});
    
    // Central Plaza (Fountain base)
    addWall(0, 0, 0x00ffff, true);
    addWall(1, 0, 0xaaaaaa, true); addWall(-1, 0, 0xaaaaaa, true);
    addWall(0, 1, 0xaaaaaa, true); addWall(0, -1, 0xaaaaaa, true);
    
    // Zone 1: Jazz Club (Top Left, Brown & Yellow)
    for(let i = -10; i <= -4; i++) {
        addWall(i, -10, 0x8B4513); addWall(i, -5, 0x8B4513);
    }
    for (let z = -9; z <= -6; z++) { addWall(-10, z, 0x8B4513); addWall(-4, z, 0x8B4513); }
    addWall(-7, -5, 0xffff00, true); // half wall door
    
    // Zone 2: EDM Stage (Top Right, Purple & Cyan)
    for(let i = 4; i <= 10; i++) { addWall(i, -10, 0x8b5cf6); addWall(i, -5, 0x8b5cf6); }
    for (let z = -9; z <= -6; z++) { addWall(4, z, 0x8b5cf6); addWall(10, z, 0x8b5cf6); }
    addWall(7, -5, 0x00ffff, true); // half wall door
    
    // Zone 3: Conservatory (Bottom Left, White & Blue)
    for(let i = -12; i <= -4; i++) { addWall(i, 12, 0xffffff); addWall(i, 6, 0xffffff); }
    for (let z = 7; z <= 11; z++) { addWall(-12, z, 0xffffff); addWall(-4, z, 0xffffff); }
    addWall(-8, 6, 0x0000ff, true); addWall(-9, 6, 0x0000ff, true); // double doors
    
    // Zone 4: Cumbia Feria (Bottom Right, Red & Green tents)
    for(let i = 4; i <= 12; i++) { addWall(i, 12, (i%2===0)?0xff0000:0x00ff00); }
    for (let z = 6; z <= 11; z++) { 
        addWall(4, z, (z%2===0)?0xff0000:0x00ff00); 
        addWall(12, z, (z%2===0)?0xff0000:0x00ff00); 
    }
    
    return blocks;
}
