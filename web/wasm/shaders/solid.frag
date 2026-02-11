#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_position;
in vec3 v_color;

uniform vec3 u_light_dir;
uniform vec3 u_eye_pos;

out vec4 frag_color;

void main() {
    vec3 N = normalize(v_normal);
    vec3 L = normalize(u_light_dir);
    vec3 V = normalize(u_eye_pos - v_position);
    vec3 H = normalize(L + V);

    /* Ambient */
    float ambient = 0.15;

    /* Diffuse (Lambert) */
    float diff = max(dot(N, L), 0.0);

    /* Back-face fill light */
    float back = max(dot(N, -L), 0.0) * 0.1;

    /* Specular (Blinn-Phong) */
    float spec = pow(max(dot(N, H), 0.0), 32.0) * 0.3;

    vec3 color = v_color * (ambient + diff + back) + vec3(spec);
    frag_color = vec4(color, 1.0);
}
