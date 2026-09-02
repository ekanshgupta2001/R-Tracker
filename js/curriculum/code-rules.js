// ── R-Tracker v2 — structural code rules per curriculum phase ────────────────
// Consumed by js/code-check.js. Pure data: regexes and hint text. Nothing here
// (or anywhere) executes student code — these are string patterns only.
//
// Rule shape:
//   required: [{ id, label, pattern, min = 1, weight, hint, also?, raw? }]
//     pattern — RegExp searched in the code with comments/strings stripped (raw: true → original text)
//     min     — minimum number of matches
//     also    — second RegExp that must also match for the rule to count
//   forbidden: [{ id, label, pattern | test(stripped, raw), severity, penalty, hint, raw? }]
//     severity CRITICAL fails the check outright; WARNING/SUGGESTION only cost points
//   passThreshold — score needed to auto-verify (default 75)
//   reflection: true — no automatic check; the submission is kept for a mentor
//
// Exposes: window.CODE_RULES

(function () {
  'use strict';

  var SENSOR_TYPES = /(ColorSensor|NormalizedColorSensor|RevColorSensorV3|DistanceSensor|TouchSensor|IMU|BNO055IMU|Rev2mDistanceSensor)\b/;
  var SENSOR_READS = /\.(red|green|blue|alpha|argb|getDistance|isPressed|getNormalizedColors|getAngularOrientation|getRobotYawPitchRollAngles|getVoltage|getState)\s*\(/;
  var SUBSYSTEM_NAME = '(Drive|Drivetrain|Chassis|Mecanum|Intake|Lift|Arm|Claw|Shooter|Slide|Wrist|Gripper|Launcher|Elevator|Turret|Outtake)';
  var MEANINGFUL_COMMENT = /\/\/[^\n]{12,}|\/\*[\s\S]{12,}?\*\//;
  var DOUBLE_UPDATE = /follower\.update\s*\(\s*\)[\s\S]{0,300}?follower\.update\s*\(\s*\)/;

  // Braces must balance in the stripped code — the cheapest "does it even compile" signal.
  function bracesBalanced(stripped) {
    var depth = 0;
    for (var i = 0; i < stripped.length; i++) {
      var ch = stripped[i];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth < 0) return false; }
    }
    return depth === 0;
  }

  // Body of the first class that extends (Linear)OpMode, or '' if none.
  function opModeBody(stripped) {
    var m = /class\s+\w+\s+extends\s+(LinearOpMode|OpMode)\b/.exec(stripped);
    if (!m) return '';
    var start = stripped.indexOf('{', m.index);
    if (start === -1) return '';
    var depth = 0;
    for (var i = start; i < stripped.length; i++) {
      if (stripped[i] === '{') depth++;
      else if (stripped[i] === '}') { depth--; if (depth === 0) return stripped.slice(start, i + 1); }
    }
    return stripped.slice(start);
  }

  var COMMON_FORBIDDEN = [
    { id: 'braces', label: 'Braces balance', test: function (s) { return !bracesBalanced(s); }, severity: 'CRITICAL', penalty: 25,
      hint: 'Your braces do not balance — this would not compile. Check every { has a matching }.' },
    { id: 'system-exit', label: 'No System.exit()', pattern: /System\.exit\s*\(/, severity: 'CRITICAL', penalty: 25,
      hint: 'Never call System.exit() in an OpMode — it kills the Robot Controller app.' },
    { id: 'while-true', label: 'No while(true)', pattern: /while\s*\(\s*true\s*\)/, severity: 'WARNING', penalty: 10,
      hint: 'Use while (opModeIsActive()) so the loop stops when the driver presses Stop.' }
  ];

  var RULES = {
    phase1: {
      passThreshold: 75,
      required: [
        { id: 'opmode', label: 'Extends LinearOpMode or OpMode', pattern: /extends\s+(LinearOpMode|OpMode)\b/, weight: 5, hint: 'Your class must extend LinearOpMode (or OpMode).' },
        { id: 'motors', label: 'Initializes at least 2 motors via hardwareMap', pattern: /hardwareMap\.(get\s*\(\s*DcMotor(Ex)?\.class|dcMotor\.get)/, min: 2, weight: 15, hint: 'Get at least two DcMotors from hardwareMap, e.g. hardwareMap.get(DcMotor.class, "left_drive").' },
        { id: 'servo', label: 'Initializes at least 1 servo via hardwareMap', pattern: /hardwareMap\.(get\s*\(\s*(Servo|CRServo)\.class|servo\.get|crservo\.get)/, weight: 10, hint: 'Get a Servo (or CRServo) from hardwareMap for your mechanism.' },
        { id: 'wait-for-start', label: 'Waits for START before the loop', pattern: /waitForStart\s*\(\s*\)|void\s+loop\s*\(/, weight: 5, hint: 'Call waitForStart() after initialization (LinearOpMode) or use the OpMode loop() structure.' },
        { id: 'loop', label: 'Runs a control loop while the OpMode is active', pattern: /opModeIsActive\s*\(\s*\)|void\s+loop\s*\(/, weight: 5, hint: 'Wrap your driving code in while (opModeIsActive()) { … }.' },
        { id: 'joystick', label: 'Reads a gamepad joystick', pattern: /gamepad[12]\.(left|right)_stick_[xy]\b/, weight: 15, hint: 'Read gamepad1.left_stick_y / left_stick_x / right_stick_x for driving.' },
        { id: 'y-invert', label: 'Inverts the joystick Y axis', pattern: /-\s*gamepad[12]\.(left|right)_stick_y\b|gamepad[12]\.(left|right)_stick_y\s*\*\s*-\s*1/, weight: 10, hint: 'Pushing the stick forward gives a negative Y — use -gamepad1.left_stick_y.' },
        { id: 'set-power', label: 'Sets motor power', pattern: /\.setPower\s*\(/, min: 2, weight: 10, hint: 'Send the joystick values to the motors with setPower().' },
        { id: 'mechanism', label: 'Controls a mechanism with a button or trigger', pattern: /gamepad[12]\.(a|b|x|y|left_bumper|right_bumper|left_trigger|right_trigger|dpad_up|dpad_down|dpad_left|dpad_right)\b/, weight: 15, also: /\.set(Power|Position)\s*\(/, hint: 'Use a button or trigger (gamepad1.a, right_trigger, …) to move a servo or a mechanism motor.' },
        { id: 'telemetry', label: 'Shows at least 2 telemetry values', pattern: /telemetry\.addData\s*\(/, min: 2, weight: 10, also: /telemetry\.update\s*\(\s*\)/, hint: 'Add at least two telemetry.addData(...) lines and call telemetry.update() each loop.' },
        { id: 'comments', label: 'Has comments that explain why', pattern: MEANINGFUL_COMMENT, min: 3, weight: 5, raw: true, hint: 'Add a few comments that explain why the code does what it does, not just what.' }
      ],
      forbidden: COMMON_FORBIDDEN.concat([
        { id: 'sleep-in-loop', label: 'No sleep() inside the TeleOp loop', pattern: /opModeIsActive\s*\(\s*\)\s*\)\s*\{[\s\S]{0,600}?\bsleep\s*\(/, severity: 'WARNING', penalty: 10, hint: 'sleep() inside the TeleOp loop freezes every control — avoid it in TeleOp.' }
      ])
    },

    phase2: {
      passThreshold: 75,
      required: [
        { id: 'classes', label: 'At least 3 classes (Robot + subsystems)', pattern: /\bclass\s+\w+/, min: 3, weight: 10, hint: 'Split the code into a Robot class and one class per subsystem.' },
        { id: 'drivetrain-class', label: 'A drivetrain subsystem class', pattern: new RegExp('class\\s+\\w*(Drive|Drivetrain|Chassis|Mecanum)\\w*\\b', 'i'), weight: 15, hint: 'Create a Drivetrain class that owns the drive motors.' },
        { id: 'mechanism-class', label: 'At least one mechanism subsystem class', pattern: new RegExp('class\\s+\\w*(Intake|Lift|Arm|Claw|Shooter|Slide|Wrist|Gripper|Launcher|Elevator|Turret|Outtake)\\w*\\b', 'i'), weight: 10, hint: 'Create a class for one mechanism (Intake, Lift, Claw, …).' },
        { id: 'robot-class', label: 'A Robot class that creates the subsystems', pattern: /class\s+Robot\b/, weight: 15, also: new RegExp('new\\s+\\w*' + SUBSYSTEM_NAME + '\\w*\\s*\\(', 'i'), hint: 'A Robot class should construct every subsystem in one place.' },
        { id: 'private-fields', label: 'Hardware fields are private', pattern: /private\s+(final\s+)?(DcMotor|DcMotorEx|Servo|CRServo)\b/, weight: 15, hint: 'Declare motor and servo fields as private inside the subsystem.' },
        { id: 'public-methods', label: 'Subsystems expose public methods', pattern: /public\s+(void|double|boolean|int|float|String|\w+)\s+\w+\s*\(/, min: 3, weight: 10, hint: 'Give each subsystem public methods like drive(), stop(), open(), close().' },
        { id: 'enum', label: 'Uses an enum for state', pattern: /\benum\s+\w+/, weight: 10, hint: 'Replace magic numbers/strings with an enum, e.g. enum ClawState { OPEN, CLOSED }.' },
        { id: 'hardwaremap-param', label: 'Subsystems receive the HardwareMap', pattern: /\(\s*HardwareMap\s+\w+/, weight: 5, hint: 'Pass hardwareMap into each subsystem constructor.' },
        { id: 'opmode', label: 'A TeleOp OpMode uses the Robot class', pattern: /extends\s+(LinearOpMode|OpMode)\b/, weight: 5, also: /new\s+Robot\s*\(/, hint: 'The OpMode should create a Robot and call its methods.' },
        { id: 'comments', label: 'Has explanatory comments', pattern: MEANINGFUL_COMMENT, min: 2, weight: 5, raw: true, hint: 'Comment the purpose of each class.' }
      ],
      forbidden: COMMON_FORBIDDEN.concat([
        { id: 'hardware-in-opmode', label: 'No direct hardware calls in the OpMode', test: function (s) { var b = opModeBody(s); return /hardwareMap\.get\s*\(|\.setPower\s*\(|\.setPosition\s*\(/.test(b); }, severity: 'WARNING', penalty: 20, hint: 'The main OpMode should only talk to the Robot/subsystem classes — no hardwareMap.get() or setPower() in it.' }
      ])
    },

    phase3: {
      passThreshold: 75,
      required: [
        { id: 'autonomous', label: 'Autonomous LinearOpMode with waitForStart()', pattern: /@Autonomous/, weight: 5, also: /waitForStart\s*\(\s*\)/, hint: 'Annotate with @Autonomous and call waitForStart().' },
        { id: 'sensor-type', label: 'Declares a sensor (color, distance, touch or IMU)', pattern: SENSOR_TYPES, weight: 15, hint: 'Get a ColorSensor, DistanceSensor, TouchSensor or IMU from hardwareMap.' },
        { id: 'sensor-read', label: 'Reads the sensor', pattern: SENSOR_READS, weight: 15, hint: 'Read a value, e.g. colorSensor.red() or distance.getDistance(DistanceUnit.CM).' },
        { id: 'decision', label: 'Makes a decision from a sensor threshold', pattern: /if\s*\([^)]*(<=|>=|<|>)[^)]*\)/, weight: 15, hint: 'Compare the reading to a threshold in an if/else to choose what to do.' },
        { id: 'state-machine', label: 'Sequential actions via an enum / switch state machine', pattern: /\benum\s+\w+|switch\s*\(|case\s+\w+\s*:/, weight: 15, hint: 'Structure the autonomous as states (enum + switch) rather than one long block.' },
        { id: 'timing', label: 'Timing or state-based transitions', pattern: /ElapsedTime|\.seconds\s*\(\s*\)|\.milliseconds\s*\(\s*\)|isBusy\s*\(\s*\)|state\s*=\s*\w+/, weight: 10, hint: 'Use an ElapsedTime timer or a state variable to move between steps.' },
        { id: 'subsystems', label: 'Uses subsystem classes from Phase 2', pattern: new RegExp('new\\s+\\w*' + SUBSYSTEM_NAME + '\\w*\\s*\\(|new\\s+Robot\\s*\\(', 'i'), weight: 10, hint: 'Reuse your Robot / subsystem classes instead of raw motor calls.' },
        { id: 'filtering', label: 'Filters sensor readings', pattern: /average|filter|samples|readings|consecutive|smooth/i, weight: 5, hint: 'Do not act on one reading — average a few or require several in a row.' },
        { id: 'stop', label: 'Stops motors when finished', pattern: /\.setPower\s*\(\s*0(\.0)?\s*\)|\.stop\s*\(\s*\)/, weight: 5, hint: 'Set every motor to 0 (or call stop()) at the end.' },
        { id: 'telemetry', label: 'Telemetry shows sensor values', pattern: /telemetry\.addData\s*\(/, weight: 5, hint: 'Show the sensor value on telemetry so you can tune thresholds.' }
      ],
      forbidden: COMMON_FORBIDDEN.concat([
        { id: 'long-sleep', label: 'No long time-based sleeps for driving', pattern: /\.setPower\s*\([^)]*\)\s*;\s*sleep\s*\(\s*\d{3,}\s*\)/, severity: 'WARNING', penalty: 10, hint: 'setPower(...); sleep(...) is open-loop driving — use sensors or encoders to decide when to stop.' }
      ])
    },

    phase4: {
      passThreshold: 75,
      required: [
        { id: 'encoders', label: 'Encoder-based movement', pattern: /getCurrentPosition\s*\(|RUN_TO_POSITION|RUN_USING_ENCODER|setTargetPosition|STOP_AND_RESET_ENCODER|Encoder\b/, weight: 15, hint: 'Use encoders (getCurrentPosition / RUN_TO_POSITION) or odometry instead of time.' },
        { id: 'pid', label: 'PID / PIDF control', pattern: /\bk[PIDF]\b|PIDController|PIDFCoefficients|PIDCoefficients|PIDFController/, weight: 20, also: /error/, hint: 'Implement a PID (kP, kI, kD, optionally kF) that acts on error = target − current.' },
        { id: 'pedro', label: 'Pedro Pathing (or equivalent) path following', pattern: /Follower|followPath|PathChain|PathBuilder/, weight: 15, hint: 'Use a Follower with followPath() (Pedro Pathing) or an equivalent path follower.' },
        { id: 'bezier', label: 'Paths built from BezierLine / BezierCurve', pattern: /BezierLine|BezierCurve/, weight: 10, hint: 'Build each segment as a BezierLine or BezierCurve.' },
        { id: 'waypoints', label: 'At least 3 waypoints (Pose/Point)', pattern: /new\s+(Pose|Point)\s*\(/, min: 3, weight: 15, hint: 'Define at least three Pose or Point waypoints for the path.' },
        { id: 'pose-nav', label: 'Pose-based navigation (x, y, heading)', pattern: /new\s+Pose\s*\(|getPose\s*\(|setStartingPose|heading/i, weight: 10, hint: 'Navigate with poses (x, y, heading), not motor timings.' },
        { id: 'follower-update', label: 'follower.update() in the loop', pattern: /follower\.update\s*\(\s*\)/, weight: 5, hint: 'Call follower.update() once every loop iteration.' },
        { id: 'telemetry', label: 'Telemetry for tuning', pattern: /telemetry\.addData\s*\(/, min: 2, weight: 5, hint: 'Show position/heading/error on telemetry (or FTC Dashboard) while tuning.' },
        { id: 'comments', label: 'Has explanatory comments', pattern: MEANINGFUL_COMMENT, min: 2, weight: 5, raw: true, hint: 'Note your tuned constants and why.' }
      ],
      forbidden: COMMON_FORBIDDEN.concat([
        { id: 'time-based', label: 'No time-based driving', pattern: /\.setPower\s*\([^)]*\)\s*;\s*sleep\s*\(\s*\d{3,}\s*\)/, severity: 'WARNING', penalty: 15, hint: 'setPower(...); sleep(...) is open-loop — Phase 4 is about closed-loop movement.' },
        { id: 'double-update', label: 'follower.update() called once per loop', pattern: DOUBLE_UPDATE, severity: 'WARNING', penalty: 10, hint: 'Call follower.update() exactly once per loop iteration.' }
      ])
    },

    phase5: {
      passThreshold: 75,
      required: [
        { id: 'bug-notes', label: 'At least 3 documented bug fixes (// BUG … / // FIX …)', pattern: /\/\/\s*(BUG|FIX|FIXED)\b[^\n]{6,}|\/\*\s*(BUG|FIX|FIXED)\b[\s\S]{6,}?\*\//i, min: 3, weight: 30, raw: true, hint: 'Mark each fix with a comment starting // BUG: (or // FIX:) that says what was wrong.' },
        { id: 'bug-explained', label: 'Bug notes explain why (because / was / caused …)', pattern: /\/\/\s*(BUG|FIX|FIXED)\b[^\n]*\b(because|was|caused|wrong|instead|should|never|always|missing)\b/i, min: 2, weight: 15, raw: true, hint: 'Say why each bug happened, e.g. "// BUG: heading drifted because update() ran twice".' },
        { id: 'telemetry', label: 'Telemetry used for debugging', pattern: /telemetry\.addData\s*\(/, min: 2, weight: 15, also: /telemetry\.update\s*\(\s*\)/, hint: 'Add telemetry for the values you used to isolate each bug.' },
        { id: 'loop', label: 'A proper OpMode loop', pattern: /opModeIsActive\s*\(\s*\)|void\s+loop\s*\(/, weight: 10, hint: 'The fixed code still needs a while (opModeIsActive()) loop (or loop()).' },
        { id: 'structure', label: 'Keeps the subsystem structure', pattern: /\bclass\s+\w+/, min: 2, weight: 10, hint: 'Keep the subsystem classes intact while fixing bugs.' },
        { id: 'systematic', label: 'Notes describe the systematic approach', pattern: /(hypothes|observ|isolat|verif|reproduc|telemetry showed|test)/i, weight: 10, raw: true, hint: 'Describe how you narrowed each bug down (observe → hypothesize → test → fix → verify).' },
        { id: 'comments', label: 'Explanatory comments', pattern: MEANINGFUL_COMMENT, min: 3, weight: 10, raw: true, hint: 'Comments should explain the reasoning, not restate the code.' }
      ],
      forbidden: COMMON_FORBIDDEN.concat([
        { id: 'double-update', label: 'Bug pattern: double update()', pattern: DOUBLE_UPDATE, severity: 'WARNING', penalty: 15, hint: 'follower.update() is still called twice in one loop — the "double update" bug is not fixed.' },
        { id: 'empty-catch', label: 'No empty catch blocks', pattern: /catch\s*\([^)]*\)\s*\{\s*\}/, severity: 'WARNING', penalty: 10, hint: 'An empty catch hides errors — at least log them to telemetry.' },
        { id: 'todo', label: 'No leftover TODOs', pattern: /\bTODO\b/, severity: 'SUGGESTION', penalty: 3, raw: true, hint: 'Resolve or remove TODO markers before submitting.' }
      ])
    },

    advanced_command: {
      passThreshold: 75,
      required: [
        { id: 'subsystem-base', label: 'Drivetrain extends SubsystemBase', pattern: /extends\s+SubsystemBase\b/, weight: 20, hint: 'Make the drivetrain subsystem extend FTCLib\'s SubsystemBase.' },
        { id: 'command-base', label: 'Commands extend CommandBase', pattern: /extends\s+CommandBase\b|implements\s+Command\b/, min: 2, weight: 15, hint: 'Write each command as a class extending CommandBase.' },
        { id: 'follow-path', label: 'A FollowPath command wrapping followPath() + isBusy()', pattern: /class\s+FollowPath\w*/i, weight: 15, also: /followPath\s*\(|isBusy\s*\(/, hint: 'FollowPath should call follower.followPath() in initialize() and finish when !follower.isBusy().' },
        { id: 'run-intake', label: 'A RunIntake command with a duration', pattern: /class\s+RunIntake\w*/i, weight: 10, also: /ElapsedTime|seconds\s*\(|milliseconds\s*\(|duration/i, hint: 'RunIntake should run the intake for a given number of seconds.' },
        { id: 'is-finished', label: 'Commands implement isFinished()', pattern: /isFinished\s*\(\s*\)/, weight: 10, hint: 'Each command needs an isFinished() that returns true when it is done.' },
        { id: 'sequential', label: 'A SequentialCommandGroup composes the autonomous', pattern: /SequentialCommandGroup/, weight: 20, hint: 'Compose FollowPath / RunIntake commands in a SequentialCommandGroup.' },
        { id: 'comparison', label: 'A note comparing both versions', pattern: /(easier|readab|modif|compar|maintain)/i, weight: 10, raw: true, hint: 'Add a comment comparing the command-based and original versions: which is easier to read and modify?' }
      ],
      forbidden: COMMON_FORBIDDEN
    },

    advanced_strategy: {
      reflection: true,
      note: 'The strategy deliverable is a written analysis (expected value, tiers, match log, strategy document) — it is kept for your mentor rather than pattern-checked.'
    },

    capstone: {
      passThreshold: 75,
      required: [
        { id: 'classes', label: 'At least 4 classes (Robot + subsystems + OpMode)', pattern: /\bclass\s+\w+/, min: 4, weight: 10, hint: 'Wrap every mechanism in its own subsystem class plus a Robot class.' },
        { id: 'private-fields', label: 'Private hardware fields', pattern: /private\s+(final\s+)?(DcMotor|DcMotorEx|Servo|CRServo)\b/, min: 2, weight: 10, hint: 'Keep motors and servos private inside subsystems.' },
        { id: 'robot-class', label: 'A Robot class', pattern: /class\s+Robot\b/, weight: 5, hint: 'A Robot class should initialize all subsystems.' },
        { id: 'enum', label: 'Enum-based state machines', pattern: /\benum\s+\w+/, weight: 5, hint: 'Use enums for subsystem and autonomous states.' },
        { id: 'sensor-decision', label: 'A sensor-driven decision', pattern: SENSOR_TYPES, weight: 10, also: /if\s*\([^)]*(<=|>=|<|>)[^)]*\)/, hint: 'Read a sensor and branch on it (colour sorting, distance stop, …).' },
        { id: 'filtering', label: 'Sensor filtering', pattern: /average|filter|samples|readings|consecutive/i, weight: 5, hint: 'No single-reading decisions — average or require consecutive readings.' },
        { id: 'pedro', label: 'Pedro Pathing follower', pattern: /Follower|followPath/, weight: 10, hint: 'Drive with Pedro Pathing\'s Follower.' },
        { id: 'waypoints', label: 'At least 4 distinct Poses', pattern: /new\s+Pose\s*\(/, min: 4, weight: 10, hint: 'Define at least four Pose waypoints.' },
        { id: 'heading-interp', label: 'Heading interpolation on paths', pattern: /set(Linear|Constant|Tangent)HeadingInterpolation/, weight: 5, hint: 'Set a heading interpolation on every path segment.' },
        { id: 'build-paths', label: 'Paths built in a buildPaths() method', pattern: /buildPaths\s*\(/, weight: 5, hint: 'Build the paths in buildPaths(), called from start()/init.' },
        { id: 'follower-update', label: 'follower.update() once per loop', pattern: /follower\.update\s*\(\s*\)/, weight: 5, hint: 'Call follower.update() every loop.' },
        { id: 'telemetry', label: 'Telemetry: state, sensors, powers, loop time', pattern: /telemetry\.addData\s*\(/, min: 4, weight: 5, hint: 'Show current state, sensor values, motor powers and loop time.' },
        { id: 'fallback', label: 'Timer-based fallback / emergency park', pattern: /ElapsedTime|timeout|fallback|park/i, weight: 10, hint: 'Add a timer fallback if a path takes too long and an emergency park near the end.' },
        { id: 'alliance', label: 'Alliance mirroring / selection', pattern: /alliance|mirror|isRed|isBlue/i, weight: 5, hint: 'Support both alliances from one codebase (selection in init, mirrored poses).' }
      ],
      forbidden: COMMON_FORBIDDEN.concat([
        { id: 'double-update', label: 'follower.update() once per loop', pattern: DOUBLE_UPDATE, severity: 'WARNING', penalty: 10, hint: 'follower.update() must run exactly once per loop.' },
        { id: 'time-based', label: 'No time-based driving', pattern: /\.setPower\s*\([^)]*\)\s*;\s*sleep\s*\(\s*\d{3,}\s*\)/, severity: 'WARNING', penalty: 10, hint: 'No time-based driving in a competition autonomous.' }
      ])
    }
  };

  window.CODE_RULES = RULES;
  window.CODE_RULES_VERSION = 'rules-1';
})();
