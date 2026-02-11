#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;

uniform mat4 u_view;
uniform mat4 u_projection;

out vec3 v_world_pos;

void main() {
    v_world_pos = a_position;
    gl_Position = u_projection * u_view * vec4(a_position, 1.0);
}
