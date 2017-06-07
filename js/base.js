var getTime = function () {
    return (new Date()).getTime() / 1000.0;
};

var startTime = getTime();
var getDeltaTime = function () {
    return getTime() - startTime;
};

var average = function (data) {
    var e = 0;

    for (var i = 0; i < data.length; i++) {
        e += (data[i] || 0);
    }

    return e / data.length;
}

function Averager(n) {
    var that = this;

    var bins = [];
    that.push = function (v) {
        bins.push(v);
        while (bins.length > n) {
            bins.shift();
        }
    }

    that.average = function () {
        return average(bins);
    }
}

function createBackgroundLayer(w, h) {
    var geometry = new THREE.PlaneGeometry(w, h);

    var uniforms = {
        time: { type: "f", value: 1.0 },
        resolution: { type: "v2", value: new THREE.Vector2() },
        gradient1: { type: "t", value: THREE.ImageUtils.loadTexture( "img/black_gradient_1.jpg" ) },
        gradient2: { type: "t", value: THREE.ImageUtils.loadTexture( "img/black_gradient_2.jpg" ) },
        amount: { type: "f", value: 0.5 },
        diffuse: { type: "c", value: new THREE.Color( 0xffffff ) },
    };

    var material = new THREE.ShaderMaterial( {
        uniforms: uniforms,
        vertexShader: document.getElementById('vertexShader').textContent,
        fragmentShader: document.getElementById('fragmentShader').textContent
    });

    var mesh = new THREE.Mesh(geometry, material);

    mesh.tick = function (dt, t) {
    };

    mesh.setHSL = function (h, s, l) {
        uniforms.diffuse.value.setHSL(h, s, l);
    };

    mesh.setHSL(0, 1.0, 0.5);

    return mesh;
}

function createParticleLayer(w, h, s, colorEnd) {
    // Create a particle group to add the emitter to.
    particleGroup = new SPE.Group({
        texture: THREE.ImageUtils.loadTexture('img/flare2.png'),
        maxAge: 10
    });

    var particleEmitter = new SPE.Emitter({
        type: 'cube',
        position: new THREE.Vector3(0, 0, 0),
        positionSpread: new THREE.Vector3(w, h, 0),
        acceleration: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 10, 0),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 0),
        sizeStart: s,
        sizeEnd: 0,
        opacityStart: 0.0,
        opacityMiddle: 0.5,
        opacityEnd: 0,
        colorStart: new THREE.Color('white'),
        colorEnd: colorEnd || new THREE.Color('white'),
    });

    // Add the emitter to the group.
    particleGroup.addEmitter( particleEmitter );
    particleEmitter.particlesPerSecond = 2.0;

    // Add the particle group to the scene so it can be drawn.
    return particleGroup;
}

var MP3_PATH = "music/So long.mp3";
var NUM_BANDS = 16;
var SMOOTHING = 0.5;

(function () {
    var renderer;

    var scene;
    var camera;
    var group;

    function setup(w, h) {
        renderer.setSize(w, h);

        scene = new THREE.Scene();

        camera = new THREE.OrthographicCamera(w * -0.5, w * 0.5, h * 0.5, h * -0.5, -1, 1000);
        group = new THREE.Object3D();

        background = createBackgroundLayer(w, h);
        background.position.z = -10;
        group.add(background);

        particles = [];
        for (var i = 0; i < NUM_BANDS; i++) {
            var colorEnd = new THREE.Color();
            colorEnd.setHSL(i / NUM_BANDS, 1.0, 0.5);

            var reverseI = NUM_BANDS - i;
            var p = createParticleLayer(w, h, ((reverseI / NUM_BANDS) + 0.5) * 50, colorEnd);
            p.material.uniforms.uOpacity.value = 0.0;
            group.add(p.mesh);
            particles.push(p);
        }

        group.tick = function (dt, t) {
            background.tick(dt, t);

            for (var i = 0; i < particles.length; i++) {
                particles[i].tick(dt, t);
            }
        }

        scene.add(camera);
        scene.add(group);
    }

    var webglEl = document.getElementById('webgl');

    if (!Detector.webgl) {
        Detector.addGetWebGLMessage(webglEl);
        return;
    }

    if (!AudioAnalyser.enabled) {
        webglEl.appendChild(document.createTextNode("AudioAnalyser failed to initialize"));
        return;
    }

    analyser = new AudioAnalyser(MP3_PATH, NUM_BANDS, SMOOTHING);

    renderer = new THREE.WebGLRenderer();
    setup(window.innerWidth, window.innerHeight);

    var energy = new Averager(5);
    var energies = [];
    for (var i = 0; i < NUM_BANDS; i++) {
        energies.push(new Averager(2));
    }

    analyser.onUpdate = (function(_this) {
        return function (bands) {
            var e = 0;
            for (var i = 0; i < bands.length; i++) {
                var b = bands[i];

                e += (b / (256.0 * bands.length));
            };
            energy.push(e);

            background.setHSL(energy.average(), 1.0, 0.5);
            for (var i = 0; i < bands.length; i++) {
                energies[i].push(bands[i] / 256.0);

                var b = energies[i].average();
                particles[i].material.uniforms.uOpacity.value = b * b;
            }
        };
    })(this);

    var t = 0;
    function render() {
        var oldTime = t;
        t = getDeltaTime();
        var dt = t - oldTime;

        group.tick(dt, t);

        renderer.render(scene, camera);
    }

    function animate() {
        requestAnimationFrame(animate);
        render();
    }

    function actualResizeHandler() {
        setup(window.innerWidth, window.innerHeight);
    }

    var resizeTimeout;
    function resizeThrottler() {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }

        resizeTimeout = setTimeout(function() {
            resizeTimeout = null;
            actualResizeHandler();
        }, 100);
    }

    $(window).resize(resizeThrottler);

    setTimeout(function () {
        analyser.start();
    }, 1000)

    document.body.appendChild(analyser.audio);
    webglEl.appendChild(renderer.domElement);

    animate();
})();
