#version 300 es
precision highp float;

in vec3 v_world_pos;

uniform vec3 u_eye_pos;

out vec4 frag_color;

void main() {
    /* Grid lines every 1 unit */
    vec2 grid = abs(fract(v_world_pos.xz - 0.5) - 0.5);
    vec2 line = fwidth(v_world_pos.xz);
    vec2 grid_aa = smoothstep(vec2(0.0), line * 1.5, grid);
    float grid_val = 1.0 - min(grid_aa.x, grid_aa.y);

    /* Fade with distance */
    float dist = length(v_world_pos.xz - u_eye_pos.xz);
    float fade = 1.0 - smoothstep(20.0, 50.0, dist);

    /* X axis (red) and Z axis (blue) */
    vec3 color = vec3(0.35);
    if (abs(v_world_pos.z) < line.y * 1.5) {
        color = vec3(0.8, 0.2, 0.2); /* X axis - red */
    }
    if (abs(v_world_pos.x) < line.x * 1.5) {
        color = vec3(0.2, 0.2, 0.8); /* Z axis - blue */
    }

    frag_color = vec4(color, grid_val * fade * 0.5);
}
