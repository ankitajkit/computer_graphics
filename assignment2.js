////////////////////////////////////////////////////////////////////////
//  A simple WebGL program to draw a 3D cube wirh basic interaction.
//

var gl;
var canvas;
var matrixStack = [];
var buf;
var indexBuf;
var aPositionLocation;
var aNormalLocation
var uColorLocation;
var uPMatrixLocation;
var uMMatrixLocation;
var uVMatrixLocation;
var uLightLocation

var spBuf;
var spIndexBuf;
var spNormalBuf;
var cubeNormalBuf;
var spVerts = [];
var spIndicies = [];
var spNormals = [];
var light = [40,40,50,1.0];


var degree1 = 0.0;
var degree0 = 0.0;
var prevMouseX = 0.0;
var prevMouseY = 0.0;

var width;
var height;

var degree12 = 0.0;
var degree02 = 0.0;

var degree13 = 0.0;
var degree03 = 0.0;


// initialize model, view, and projection matrices
var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix

// specify camera/eye coordinate system parameters
var eyePos = [0.0, 0.0, 2.0];
var COI = [0.0, 0.0, 0.0];
var viewUp = [0.0, 1.0, 0.0];

// Vertex shader code
const flatVertexShaderCode = `#version 300 es
in vec3 aPosition;
uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;
out mat4 VMatrix;
out vec3 posInEyeSpace;
void main() {
  mat4 projectionModelView;
  projectionModelView = uPMatrix * uVMatrix * uMMatrix; //clip space
  gl_Position = projectionModelView * vec4(aPosition, 1.0);
  posInEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition,1.0)).rgb;
  VMatrix=uVMatrix;
  gl_PointSize = 5.0;
}
`;
// Fragment shader code
const flatFragShaderCode = `#version 300 es
precision mediump float;
in mat4 VMatrix;
in vec3 posInEyeSpace;

uniform vec4 objColor;
uniform vec4 light;

vec3 normal,L,R,V;

out vec4 fragColor;

void main() {
  normal = normalize(cross(dFdx(posInEyeSpace), dFdy(posInEyeSpace)));
  L = normalize(vec3(VMatrix * light) - posInEyeSpace);
  R = normalize(-reflect(L,normal));
  V = normalize(-posInEyeSpace);

  float Cd = 1.3*max(0.0,dot(normal,L));
  float Cs = 1.3*pow(max(0.0,dot(R,V)),16.0);
  vec3 perFragColor = vec3((0.2*objColor + Cd*objColor  + Cs));
  fragColor = vec4(perFragColor, 1.0); 
}`;
// Vertex shader code
const perVerVertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;
uniform vec4 light;

mat4 projectionModelView;
mat3 NormalTransformation;

vec3 posInEyeSpace;
vec3 L,R,V,normal;

out float Cd;
out float Cs;

void main() {
  
  projectionModelView = uPMatrix * uVMatrix * uMMatrix; 
  gl_Position = projectionModelView * vec4(aPosition, 1.0);
  posInEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition,1.0)).rgb;
  
  NormalTransformation= mat3(uVMatrix *uMMatrix);
  normal = normalize(NormalTransformation*aNormal);
  L = normalize(vec3(uVMatrix * light) - posInEyeSpace);
  R = normalize(-reflect(L,normal));
  V = normalize(-posInEyeSpace);

  Cd = 1.3*max(0.0,dot(normal,L));
  Cs = 1.3*pow(max(0.0,dot(R,V)),16.0);

  gl_PointSize = 5.0; 
}`;
// Fragment shader code
const perVerFragShaderCode = `#version 300 es
precision mediump float;
out vec4 fragColor;
uniform vec4 objColor;

in float Cd;
in float Cs;

void main() {
  vec3 perVertexColor = vec3(0.2*objColor + Cd*objColor + Cs);
  fragColor = vec4(perVertexColor, 1.0);
}`;
// Vertex shader code
const perFragvertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;

out mat4 MMatrix;
out mat4 VMatrix;
out vec3 posInEyeSpace;
out vec3 NNormal;
void main() {
  mat4 projectionModelView;
  projectionModelView = uPMatrix * uVMatrix * uMMatrix; 
  gl_Position = projectionModelView * vec4(aPosition, 1.0);
  posInEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition,1.0)).rgb;
  
  VMatrix = uVMatrix;
  MMatrix = uMMatrix;
  NNormal = aNormal;
  gl_PointSize = 5.0;
}
`;
// Fragment shader code
const perFragFragShaderCode = `#version 300 es
precision mediump float;
in mat4 VMatrix;
in mat4 MMatrix;
in vec3 posInEyeSpace;
in vec3 NNormal;

uniform vec4 objColor;
uniform vec4 light;

vec3 L,R,V,normal;
mat3 NormalTransformation;

out vec4 fragColor;

void main() {
  NormalTransformation= mat3(VMatrix *MMatrix);
  normal = normalize(NormalTransformation*NNormal);
  L = normalize(vec3(VMatrix * light) - posInEyeSpace);
  R = normalize(-reflect(L,normal));
  V = normalize(-posInEyeSpace);

  float Cd = 1.3*max(0.0,dot(normal,L));
  float Cs = 1.3*pow(max(0.0,dot(R,V)),16.0);
  vec3 perFragColor = vec3(0.2*objColor + Cd*objColor + Cs);
  fragColor = (vec4(perFragColor, 1.0)); 
}`;

function vertexShaderSetup(vertexShaderCode) {
  shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, vertexShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function fragmentShaderSetup(fragShaderCode) {
  shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, fragShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function initShaders(vertexShaderCode,fragShaderCode) {
  shaderProgram = gl.createProgram();

  var vertexShader = vertexShaderSetup(vertexShaderCode);
  var fragmentShader = fragmentShaderSetup(fragShaderCode);

  // attach the shaders
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  //link the shader program
  gl.linkProgram(shaderProgram);

  // check for compilation and linking status
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.log(gl.getShaderInfoLog(vertexShader));
    console.log(gl.getShaderInfoLog(fragmentShader));
  }

  //finally use the program.
  gl.useProgram(shaderProgram);

  return shaderProgram;
}

function initGL(canvas) {
  try {
    gl = canvas.getContext("webgl2"); // the graphics webgl2 context
    gl.viewportWidth = canvas.width; // the width of the canvas
    gl.viewportHeight = canvas.height; // the height
  } catch (e) {}
  if (!gl) {
    alert("WebGL initialization failed");
  }
}

function pushMatrix(stack, m) {
  //necessary because javascript only does shallow push
  var copy = mat4.create(m);
  stack.push(copy);
}

function popMatrix(stack) {
  if (stack.length > 0) return stack.pop();
  else console.log("stack has no matrix to pop!");
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}
// New sphere initialization function
function initSphere(nslices, nstacks, radius) {
  for (var i = 0; i <= nslices; i++) {
    var angle = (i * Math.PI) / nslices;
    var comp1 = Math.sin(angle);
    var comp2 = Math.cos(angle);

    for (var j = 0; j <= nstacks; j++) {
      var phi = (j * 2 * Math.PI) / nstacks;
      var comp3 = Math.sin(phi);
      var comp4 = Math.cos(phi);

      var xcood = comp4 * comp1;
      var ycoord = comp2;
      var zcoord = comp3 * comp1;

      spVerts.push(radius * xcood, radius * ycoord, radius * zcoord);
      spNormals.push(xcood, ycoord, zcoord);
    }
  }

  // now compute the indices here
  for (var i = 0; i < nslices; i++) {
    for (var j = 0; j < nstacks; j++) {
      var id1 = i * (nstacks + 1) + j;
      var id2 = id1 + nstacks + 1;

      spIndicies.push(id1, id2, id1 + 1);
      spIndicies.push(id2, id2 + 1, id1 + 1);
    }
  }
}

function initSphereBuffer() {
  var nslices = 25;
  var nstacks = 25;
  var radius = 0.5;

  initSphere(nslices, nstacks, radius);

  // buffer for vertices
  spBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spVerts), gl.STATIC_DRAW);
  spBuf.itemSize = 3;
  spBuf.numItems = spVerts.length / 3;

  // buffer for indices
  spIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint32Array(spIndicies),
    gl.STATIC_DRAW
  );
  spIndexBuf.itemsize = 1;
  spIndexBuf.numItems = spIndicies.length;

  // buffer for normals
  spNormalBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spNormals), gl.STATIC_DRAW);
  spNormalBuf.itemSize = 3;
  spNormalBuf.numItems = spNormals.length / 3;
}

function drawSphere(color) {
  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
  gl.vertexAttribPointer(
    aPositionLocation,
    spBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
  gl.vertexAttribPointer(
    aNormalLocation,
    spNormalBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );
  // draw elementary arrays - triangle indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);

  gl.uniform4fv(uColorLocation, color);
  gl.uniform4fv(uLightLocation,light);
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

  gl.drawElements(gl.TRIANGLES, spIndexBuf.numItems, gl.UNSIGNED_INT, 0);  
}

// Cube generation function with normals
function initCubeBuffer() {
    var vertices = [
      // Front face
      -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
      // Back face
      -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
      // Top face
      -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
      // Bottom face
      -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
      // Right face
      0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
      // Left face
      -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
    ];
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    buf.itemSize = 3;
    buf.numItems = vertices.length / 3;
  
    var normals = [
      // Front face
      0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
      // Back face
      0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
      // Top face
      0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
      // Bottom face
      0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
      // Right face
      1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
      // Left face
      -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
    ];
    cubeNormalBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    cubeNormalBuf.itemSize = 3;
    cubeNormalBuf.numItems = normals.length / 3;
  
  
    var indices = [
      0,
      1,
      2,
      0,
      2,
      3, // Front face
      4,
      5,
      6,
      4,
      6,
      7, // Back face
      8,
      9,
      10,
      8,
      10,
      11, // Top face
      12,
      13,
      14,
      12,
      14,
      15, // Bottom face
      16,
      17,
      18,
      16,
      18,
      19, // Right face
      20,
      21,
      22,
      20,
      22,
      23, // Left face
    ];
    indexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW
    );
    indexBuf.itemSize = 1;
    indexBuf.numItems = indices.length;
  }
function drawCube(color) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.vertexAttribPointer(
    aPositionLocation,
    buf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
  gl.vertexAttribPointer(
    aNormalLocation,
    cubeNormalBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );
  // draw elementary arrays - triangle indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);

  gl.uniform4fv(uColorLocation, color);
  gl.uniform4fv(uLightLocation,light);
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

  gl.drawElements(gl.TRIANGLES, indexBuf.numItems, gl.UNSIGNED_SHORT, 0);
  //gl.drawArrays(gl.LINE_STRIP, 0, buf.numItems); // show lines
  //gl.drawArrays(gl.POINTS, 0, buf.numItems); // show points
}

function shaderDeclare() {
  //get locations of attributes and uniforms declared in the shader
  aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
  aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
  uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
  uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
  uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
  uColorLocation = gl.getUniformLocation(shaderProgram, "objColor");
  uLightLocation = gl.getUniformLocation(shaderProgram, "light");
  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);
  gl.enableVertexAttribArray(aNormalLocation);
  gl.enable(gl.DEPTH_TEST);
}

function drawView1() {
  // set up the view matrix, multiply into the modelview matrix
  mat4.identity(vMatrix);
  var color
  vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);
  //set up perspective projection matrix
  mat4.identity(pMatrix);
  mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);
  //set up the model matrix
  mat4.identity(mMatrix);
  // transformations applied here on model matrix
  mMatrix = mat4.rotate(mMatrix, degToRad(degree0), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree1), [1, 0, 0]);
  //cube
  pushMatrix(matrixStack, mMatrix);
  color = [0.682, 0.682, 0.459,1];
  mMatrix = mat4.translate(mMatrix, [0.0, -0.15, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(30), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(10), [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(5), [0, 0, 1]);
  mMatrix = mat4.scale(mMatrix, [0.4, 0.65, 0.4]);
  drawCube(color);
  mMatrix = popMatrix(matrixStack);
  //sphere
  pushMatrix(matrixStack, mMatrix);
  color = [0.016, 0.424, 0.624,1];
  mMatrix = mat4.translate(mMatrix, [0, 0.4, 0.18]);
  mMatrix = mat4.rotate(mMatrix, degToRad(20), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(10), [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(5), [0, 0, 1]);
  mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
  drawSphere(color);
  mMatrix = popMatrix(matrixStack);

}

function drawView2() {
  // set up the view matrix, multiply into the modelview matrix
  mat4.identity(vMatrix);
  var color
  vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);
  //set up perspective projection matrix
  mat4.identity(pMatrix);
  mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);
  //set up the model matrix
  mat4.identity(mMatrix);
  // transformations applied here on model matrix
  mMatrix = mat4.rotate(mMatrix, degToRad(degree02), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree12), [1, 0, 0]);

  //sphere1
  pushMatrix(matrixStack, mMatrix);
  color = [0.506, 0.506, 0.506,1];
  mMatrix = mat4.translate(mMatrix, [-0.05, -0.3, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(10), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [0.65, 0.65, 0.65]);
  drawSphere(color);
  mMatrix = popMatrix(matrixStack);
  //cube1
  pushMatrix(matrixStack, mMatrix);
  color = [0.004, 0.592, 0,1];
  mMatrix = mat4.translate(mMatrix, [-0.46, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-25), [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, degToRad(10), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [0.35, 0.35, 0.35]);
  drawCube(color);
  mMatrix = popMatrix(matrixStack);
  //sphere2
  pushMatrix(matrixStack, mMatrix);
  color = [0.506, 0.506, 0.506,1];
  mMatrix = mat4.translate(mMatrix, [-0.32, 0.32, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-25), [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, degToRad(10), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [0.35, 0.35, 0.35]);
  drawSphere(color);
  //cube2
  mMatrix = popMatrix(matrixStack);
  pushMatrix(matrixStack, mMatrix);
  color = [0.004, 0.592, 0,1];
  mMatrix = mat4.translate(mMatrix, [-0.05, 0.45, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(25), [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, degToRad(30), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [0.25, 0.25, 0.25]);
  drawCube(color);
  mMatrix = popMatrix(matrixStack);
  //sphere3
  pushMatrix(matrixStack, mMatrix);
  color = [0.506, 0.506, 0.506,1];
  mMatrix = mat4.translate(mMatrix, [-0.11, 0.61, 0.15]);
  mMatrix = mat4.rotate(mMatrix, degToRad(25), [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, degToRad(10), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 0.2]);
  drawSphere(color);
}

function drawView3() {
  // set up the view matrix, multiply into the modelview matrix
  mat4.identity(vMatrix);
  var color
  vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);
  //set up perspective projection matrix
  mat4.identity(pMatrix);
  mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);
  //set up the model matrix
  mat4.identity(mMatrix);
  // transformations applied here on model matrix
  mMatrix = mat4.rotate(mMatrix, degToRad(degree03), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree13), [1, 0, 0]);

  //sphere1
  pushMatrix(matrixStack, mMatrix);
  color = [0.0, 0.551, 0.125 ,1.0];
  mMatrix = mat4.translate(mMatrix, [0.0, -0.64, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(22), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-5), [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(5), [0, 0, 1]);;
  mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
  drawSphere(color);
  mMatrix = popMatrix(matrixStack);
  //cube1
  pushMatrix(matrixStack, mMatrix);
  color = [0.416, 0.145, 0.055, 1.0];
  mMatrix = mat4.translate(mMatrix, [-0.0, -0.43, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(30), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(5), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [1.2, 0.03, 0.3]);
  drawCube(color);
  mMatrix = popMatrix(matrixStack);
  //sphere2
  pushMatrix(matrixStack, mMatrix);
  color = [0.290, 0.290, 0.615, 1.0];
  mMatrix = mat4.translate(mMatrix, [-0.35, -0.215, 0.2]);
  mMatrix = mat4.rotate(mMatrix, degToRad(22), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-5), [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(5), [0, 0, 1]);;
  mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
  drawSphere(color);
  mMatrix = popMatrix(matrixStack);
  //sphere3
  pushMatrix(matrixStack, mMatrix);
  color = [0.133, 0.424, 0.494, 1.0];
  mMatrix = mat4.translate(mMatrix, [0.35, -0.215, -0.2]);
  mMatrix = mat4.rotate(mMatrix, degToRad(22), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-5), [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(5), [0, 0, 1]);;
  mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
  drawSphere(color);
  mMatrix = popMatrix(matrixStack);
  //cube2
  pushMatrix(matrixStack, mMatrix);
  color = [0.776, 0.776, 0, 1.0];
  mMatrix = mat4.translate(mMatrix, [-0.4, 0.00, 0.2]);
  mMatrix = mat4.rotate(mMatrix, degToRad(90), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(22), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-5), [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(5), [0, 0, 1]);
  mMatrix = mat4.scale(mMatrix, [1.2, 0.03, 0.3]);
  drawCube(color);
  mMatrix = popMatrix(matrixStack);
  //cube3
  pushMatrix(matrixStack, mMatrix);
  color = [0.204, 0.749, 0.580, 1.0];
  mMatrix = mat4.translate(mMatrix, [0.35, 0.002, -0.2]);
  mMatrix = mat4.rotate(mMatrix, degToRad(90), [0, 1, 0])
  mMatrix = mat4.rotate(mMatrix, degToRad(22), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-5), [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(5), [0, 0, 1]);;
  mMatrix = mat4.scale(mMatrix, [1.2, 0.03, 0.3]);
  drawCube(color);
  mMatrix = popMatrix(matrixStack);
  //sphere4
  pushMatrix(matrixStack, mMatrix);
  color = [0.475, 0, 0.475, 1.0];
  mMatrix = mat4.translate(mMatrix, [-0.368, 0.208, 0.3]);
  mMatrix = mat4.rotate(mMatrix, degToRad(22), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-5), [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(5), [0, 0, 1]);;
  mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
  drawSphere(color);
  mMatrix = popMatrix(matrixStack);
  //sphere5
  pushMatrix(matrixStack, mMatrix);
  color = [0.706, 0.525, 0.239, 1.0];
  mMatrix = mat4.translate(mMatrix, [0.35, 0.215, -0.15]);
  mMatrix = mat4.rotate(mMatrix, degToRad(22), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-5), [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(5), [0, 0, 1]);;
  mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
  drawSphere(color);
  mMatrix = popMatrix(matrixStack);
  //cube4
  pushMatrix(matrixStack, mMatrix);
  color = [0.416, 0.145, 0.055, 1.0];
  mMatrix = mat4.translate(mMatrix, [-0.0, 0.42, 0.15]);
  mMatrix = mat4.rotate(mMatrix, degToRad(30), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(5), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [1.2, 0.03, 0.3]);
  drawCube(color);
  mMatrix = popMatrix(matrixStack);
  //sphere6
  pushMatrix(matrixStack, mMatrix);
  color = [0.467, 0.463, 0.592, 1.0];
  mMatrix = mat4.translate(mMatrix, [0.0, 0.63, 0.15]);
  mMatrix = mat4.rotate(mMatrix, degToRad(22), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-5), [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(5), [0, 0, 1]);;
  mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
  drawSphere(color);
  mMatrix = popMatrix(matrixStack);
}
//////////////////////////////////////////////////////////////////////
//Main drawing routine
function drawScene() {
  // You need to enable scissor_test to be able to use multiple viewports
  gl.enable(gl.SCISSOR_TEST);

  //drawing left most view
  gl.viewport(0, 0, width/3, height);
  gl.scissor(0, 0, width/3, height);
  gl.clearColor(0.827, 0.827, 0.933, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  flatShaderProgram = initShaders(flatVertexShaderCode,flatFragShaderCode);
  shaderDeclare();
  drawView1();
  //drawing middle view
  gl.viewport(width/3, 0, width/3, height);
  gl.scissor(width/3, 0, width/3, height);
  gl.clearColor(0.933, 0.827, 0.824, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  perVerShaderProgram = initShaders(perVerVertexShaderCode,perVerFragShaderCode);
  shaderDeclare();
  drawView2();

  //drawing right most view
  gl.viewport(2*width/3, 0, width/3, height);
  gl.scissor(2*width/3, 0, width/3, height);
  gl.clearColor(0.827, 0.933, 0.827, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  perFragShaderProgram = initShaders(perFragvertexShaderCode,perFragFragShaderCode);
  shaderDeclare();
  drawView3();
  
}

function onMouseDown(event) {
  document.addEventListener("mousemove", onMouseMove, false);
  document.addEventListener("mouseup", onMouseUp, false);
  document.addEventListener("mouseout", onMouseOut, false);

  if (
    event.layerX <= canvas.width &&
    event.layerX >= 0 &&
    event.layerY <= canvas.height &&
    event.layerY >= 0
  ) {
    prevMouseX = event.clientX;
    prevMouseY = canvas.height - event.clientY;
  }
}

function onMouseMove(event) {
  // make mouse interaction only within canvas
  if (
    event.layerX <= width/3 &&
    event.layerX >= 0 &&
    event.layerY <= height &&
    event.layerY >= 0
  ) {
    var mouseX = event.clientX;
    var diffX1 = mouseX - prevMouseX;
    prevMouseX = mouseX;
    degree0 = degree0 + diffX1 / 5;

    var mouseY = canvas.height - event.clientY;
    var diffY2 = mouseY - prevMouseY;
    prevMouseY = mouseY;
    degree1 = degree1 - diffY2 / 5;
     
    drawScene();
  }
   else if (
    event.layerX <= 2*width/3 &&
    event.layerX >= width/3  &&
    event.layerY <= height &&
    event.layerY >= 0
  ) {
    var mouseX = event.clientX;
    var diffX1 = mouseX - prevMouseX;
    prevMouseX = mouseX;
    degree02 = degree02 + diffX1 / 5;

    var mouseY = canvas.height - event.clientY;
    var diffY2 = mouseY - prevMouseY;
    prevMouseY = mouseY;
    degree12 = degree12 - diffY2 / 5;
    drawScene();
  }
  else if (
    event.layerX <= width &&
    event.layerX >= 2*width/3  &&
    event.layerY <= height &&
    event.layerY >= 0
  ) {
    var mouseX = event.clientX;
    var diffX1 = mouseX - prevMouseX;
    prevMouseX = mouseX;
    degree03 = degree03 + diffX1 / 5;

    var mouseY = canvas.height - event.clientY;
    var diffY2 = mouseY - prevMouseY;
    prevMouseY = mouseY;
    degree13 = degree13 - diffY2 / 5;

    drawScene();
  }
}

function onMouseUp(event) {
  document.removeEventListener("mousemove", onMouseMove, false);
  document.removeEventListener("mouseup", onMouseUp, false);
  document.removeEventListener("mouseout", onMouseOut, false);
}

function onMouseOut(event) {
  document.removeEventListener("mousemove", onMouseMove, false);
  document.removeEventListener("mouseup", onMouseUp, false);
  document.removeEventListener("mouseout", onMouseOut, false);
}

// This is the entry point from the html
function webGLStart() {
  canvas = document.getElementById("assignment2");
  document.addEventListener("mousedown", onMouseDown, false);
  // register the event listener for zoom 
  sliderZoom = document.getElementById("sliderZoomId");
  sliderZoom.addEventListener("input", sliderChanged);
  // register the event listener for light 
  sliderLight = document.getElementById("sliderLightId");
  sliderLight.addEventListener("input", sliderChanged);

  // initialize WebGL
  initGL(canvas);
  
  width = canvas.width;
  height = canvas.height;
  //initialize buffers for the square
  initCubeBuffer();
  initSphereBuffer();

  drawScene();
}
// slider callback function
var sliderZoom;
var sliderLight;
function sliderChanged() {
  var valueZoom = parseFloat(sliderZoom.value);
  var valueLight = parseFloat(sliderLight.value);
  light = [40+valueLight,40,50,1.0];
  eyePos = [0.0, 0.0, 2.0+valueZoom];
  drawScene();
}



