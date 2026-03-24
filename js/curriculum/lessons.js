// ── R-Tracker Curriculum — Interactive Lesson System ─────────────────────────
// Defines structured lesson content per phase and renders it interactively.
// Exposes: window.PHASE_LESSONS, window.renderLessons(), window.getLessonProgress()

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════════════════
     PHASE 1 LESSON CONTENT — "Make It Move"
     ══════════════════════════════════════════════════════════════════════ */
  var PHASE_1_LESSONS = [
    {
      id: 'ftc-ecosystem',
      title: 'The FTC Ecosystem',
      learn: 'Before you write a single line of code, you need to understand what you\'re talking to. The <strong>Control Hub</strong> is the robot\'s brain — your code lives there. The <strong>Driver Station</strong> (a phone or tablet with gamepads) sends commands to the Control Hub over Wi-Fi Direct. When you press "Init" then "Start" on the Driver Station, you\'re telling the Control Hub: "Go!"<br><br>Every FTC match has two phases: <strong>Autonomous</strong> (30 seconds, robot runs entirely on pre-written code, no gamepads) and <strong>TeleOp</strong> (2 minutes, drivers control the robot with gamepads). Your code handles both.',
      check: {
        question: 'During the Autonomous period, how is the robot controlled?',
        type: 'multiple_choice',
        options: [
          { text: 'Drivers use gamepads to control it', correct: false, explanation: 'That\'s TeleOp. During Autonomous, gamepads are not allowed.' },
          { text: 'It runs pre-written code with zero driver input', correct: true, explanation: 'Correct! The robot acts completely on its own for 30 seconds using code you wrote in advance.' },
          { text: 'A coach sends wireless commands from the sideline', correct: false, explanation: 'Nobody controls the robot during Autonomous — that\'s what makes it autonomous.' },
          { text: 'It replays a recording of driver inputs', correct: false, explanation: 'While that\'s a creative idea, the robot runs actual code logic, not recordings.' }
        ]
      },
      mentorTip: 'In the early days of FTC, robots used Lego bricks and long tether cables. Now we have high-speed wireless control. It\'s like going from a rotary phone to a smartphone.'
    },
    {
      id: 'hardware-map',
      title: 'The Hardware Map',
      learn: 'The Hardware Map is the robot\'s contact list. Every motor, servo, and sensor plugged into the Control Hub gets a <strong>name</strong> in the configuration. In your code, you use that exact name to "look up" the device — if the name doesn\'t match exactly (even capitalization matters!), the robot will crash.<br><br>You also have to tell the Hub what <strong>type</strong> of device is plugged into each port using a dropdown menu. If you tell it a motor port has a servo, the code will try to speak the wrong "language" and nothing will happen.',
      code: {
        language: 'java',
        snippet: `// Declare the hardware variable
DcMotor leftDrive;

// In your init, link it to the physical device by name
leftDrive = hardwareMap.get(DcMotor.class, "left_drive");

// Now leftDrive IS the physical motor.
// Anything you do to this variable happens to the real motor.`
      },
      check: {
        question: 'Your code says hardwareMap.get(DcMotor.class, "left_drive") but in the Driver Station config you named it "Left_Drive". What happens?',
        type: 'multiple_choice',
        options: [
          { text: 'It works fine — Java ignores capitalization', correct: false, explanation: 'Java is case-sensitive. "left_drive" and "Left_Drive" are completely different names.' },
          { text: 'The robot crashes with a NullPointerException', correct: true, explanation: 'Correct! The Hardware Map can\'t find "left_drive" because the config has "Left_Drive". This is the #1 cause of "my code isn\'t working" in FTC.' },
          { text: 'The motor runs at half speed', correct: false, explanation: 'A name mismatch doesn\'t reduce speed — it crashes the whole program.' },
          { text: 'The code auto-corrects the name', correct: false, explanation: 'There is no auto-correct. The name must match exactly, character for character.' }
        ]
      },
      mentorTip: '90% of "My code isn\'t working!" moments in FTC are actually just a typo in the Hardware Map. It\'s the "Is it plugged in?" of the programming world.'
    },
    {
      id: 'opmode-types',
      title: 'LinearOpMode vs Iterative OpMode',
      learn: 'There are two ways to structure your robot code:<br><br><strong>LinearOpMode</strong> runs top-to-bottom like a recipe. It waits for Start, then executes your instructions in order. Great for Autonomous because you can say "drive forward, then turn, then stop." The downside: if you use <code>sleep()</code>, the robot is deaf to everything else during that wait.<br><br><strong>Iterative OpMode</strong> runs a loop function 50 times per second. It constantly checks inputs and reacts. Perfect for TeleOp because it can read gamepads every cycle. The downside: you can NEVER use <code>sleep()</code> here — it would freeze the robot\'s brain for the entire duration.',
      check: {
        question: 'Why is sleep() dangerous in an Iterative OpMode?',
        type: 'multiple_choice',
        options: [
          { text: 'It uses too much battery power', correct: false, explanation: 'sleep() doesn\'t affect battery. The problem is about control flow.' },
          { text: 'It blocks the loop, freezing ALL robot control for the duration', correct: true, explanation: 'Correct! The loop runs 50 times per second. If you sleep(2000), the robot can\'t read gamepads, check sensors, or respond to Stop for 2 full seconds. That\'s dangerous.' },
          { text: 'It makes the code harder to read', correct: false, explanation: 'Readability isn\'t the issue — the problem is functional. The robot literally cannot respond to anything during a sleep().' },
          { text: 'It only works on Android, not the Control Hub', correct: false, explanation: 'sleep() works everywhere — the problem is that it blocks the entire loop iteration.' }
        ]
      },
      mentorTip: 'Using sleep() in an Iterative OpMode is like trying to pause a live TV broadcast by yelling at the screen — it doesn\'t work, and everyone around you gets confused.'
    },
    {
      id: 'motor-power',
      title: 'Motor Power: The -1.0 to 1.0 Range',
      learn: 'In FTC, you don\'t tell motors "drive at 5 mph." You set a <strong>power level</strong> between <strong>-1.0</strong> and <strong>1.0</strong>. Think of it as a percentage of voltage sent to the motor:<br><br>&bull; <code>1.0</code> = full speed forward (100%)<br>&bull; <code>0.5</code> = half speed forward<br>&bull; <code>0.0</code> = stop<br>&bull; <code>-1.0</code> = full speed backward<br><br>Important physics note: <code>0.1</code> power often won\'t move the robot at all. Friction in the gears and weight on the wheels means you typically need at least <code>0.2</code> to overcome "stiction" (static friction).',
      code: {
        language: 'java',
        snippet: `// Full speed forward
leftDrive.setPower(1.0);

// Half speed backward
leftDrive.setPower(-0.5);

// Stop the motor
leftDrive.setPower(0.0);`
      },
      check: {
        question: 'You call leftDrive.setPower(0.1) but the robot doesn\'t move. Why?',
        type: 'multiple_choice',
        options: [
          { text: 'The motor is broken', correct: false, explanation: 'The motor is fine — 0.1 is just not enough power to overcome friction.' },
          { text: '0.1 is below the static friction threshold — not enough force to start moving', correct: true, explanation: 'Correct! The gears and wheels have friction. You usually need at least 0.2-0.3 power to get the robot to actually start moving.' },
          { text: 'setPower only accepts integers, not decimals', correct: false, explanation: 'setPower accepts doubles (decimals). The range is -1.0 to 1.0.' },
          { text: 'You need to call motor.start() first', correct: false, explanation: 'There is no start() method. setPower() directly controls the motor.' }
        ]
      }
    },
    {
      id: 'first-opmode',
      title: 'Your First OpMode',
      learn: 'Let\'s look at the complete structure of a basic LinearOpMode. Every FTC program follows this skeleton: <strong>declare hardware</strong> at the top, <strong>initialize</strong> it inside <code>runOpMode()</code> by linking to the Hardware Map, <strong>wait for Start</strong>, then run your <strong>control loop</strong>. The <code>while(opModeIsActive())</code> loop keeps running until the driver presses Stop.',
      code: {
        language: 'java',
        snippet: `@TeleOp(name = "MyFirstTeleOp")
public class MyFirstTeleOp extends LinearOpMode {
    DcMotor leftDrive; // 1. Declare

    @Override
    public void runOpMode() {
        // 2. Initialize from Hardware Map
        leftDrive = hardwareMap.get(DcMotor.class, "left_drive");

        waitForStart(); // 3. Wait for driver to press START

        while (opModeIsActive()) { // 4. Control loop
            leftDrive.setPower(0.5); // Runs at 50% until STOP
        }
    }
}`
      },
      check: {
        question: 'What does waitForStart() do?',
        type: 'multiple_choice',
        options: [
          { text: 'Starts the motors automatically', correct: false, explanation: 'waitForStart() doesn\'t start anything — it pauses your code until the driver presses Start.' },
          { text: 'Pauses the program until the driver presses START on the Driver Station', correct: true, explanation: 'Correct! Everything before waitForStart() is initialization. Everything after it runs during the match.' },
          { text: 'Waits 30 seconds for Autonomous to finish', correct: false, explanation: 'waitForStart() waits for the human to press Start, not for a timer.' },
          { text: 'Connects to the Wi-Fi network', correct: false, explanation: 'Wi-Fi is already connected before your code runs. waitForStart() is about match timing.' }
        ]
      }
    },
    {
      id: 'gamepad-y-axis',
      title: 'The Gamepad & Y-Axis Inversion',
      learn: 'This is the <strong>#1 bug on every first-year FTC team</strong>. The gamepad joystick Y-axis is <strong>inverted</strong>: pushing the stick <strong>UP</strong> returns <strong>-1.0</strong>, and pushing it <strong>DOWN</strong> returns <strong>+1.0</strong>. This means if you directly use <code>gamepad1.left_stick_y</code> as motor power, your robot drives <strong>backward</strong> when you push forward.<br><br>The fix is simple: negate it. <code>-gamepad1.left_stick_y</code> flips the value so UP = positive = forward.',
      code: {
        language: 'java',
        snippet: `// WRONG — robot drives backward when stick pushed forward
double drive = gamepad1.left_stick_y;

// CORRECT — negate to fix the inversion
double drive = -gamepad1.left_stick_y;

// Now: stick UP → -1.0 → negated → +1.0 → forward!`
      },
      check: {
        question: 'A student writes: double power = gamepad1.left_stick_y; and pushes the joystick UP. What does the robot do?',
        type: 'multiple_choice',
        options: [
          { text: 'Drives forward at full speed', correct: false, explanation: 'Pushing UP gives -1.0. Without negation, the motor gets -1.0 which is BACKWARD.' },
          { text: 'Drives backward at full speed', correct: true, explanation: 'Correct! UP returns -1.0. The motor receives -1.0 = full backward. This is why you MUST negate the Y-axis.' },
          { text: 'Doesn\'t move at all', correct: false, explanation: 'The motor does receive power (-1.0), so it definitely moves — just in the wrong direction.' },
          { text: 'Turns left', correct: false, explanation: 'A single motor with left_stick_y doesn\'t cause turning — it drives forward or backward.' }
        ]
      },
      mentorTip: 'If you ever see a robot zoom backward off the field at competition, there\'s a 99% chance someone forgot the negative sign. It happens to the best of us.'
    },
    {
      id: 'gamepad-buttons',
      title: 'Buttons, Triggers, and Mechanisms',
      learn: 'Joysticks give you <strong>float values</strong> (-1.0 to 1.0) for smooth control. Buttons give you <strong>booleans</strong> (true/false) for on/off actions. Triggers give you <strong>floats</strong> (0.0 to 1.0) for variable pressure.<br><br>Common pattern: use joysticks for driving, buttons for mechanisms (claw open/close, preset positions), and triggers for variable-speed intake or turbo mode. The second gamepad (<code>gamepad2</code>) is typically used by a co-driver who controls mechanisms while the main driver focuses on driving.',
      code: {
        language: 'java',
        snippet: `// Joystick — smooth driving
double drive = -gamepad1.left_stick_y;
double turn = gamepad1.right_stick_x;

// Button — toggle mechanism
if (gamepad1.a) {
    clawServo.setPosition(1.0); // Open
} else if (gamepad1.b) {
    clawServo.setPosition(0.0); // Close
}

// Trigger — variable speed intake
intakeMotor.setPower(gamepad2.right_trigger);`
      },
      check: {
        question: 'What data type does gamepad1.left_trigger return?',
        type: 'multiple_choice',
        options: [
          { text: 'boolean (true/false)', correct: false, explanation: 'Buttons are boolean, but triggers are pressure-sensitive — they return a range of values.' },
          { text: 'int (0 or 1)', correct: false, explanation: 'Triggers aren\'t simple on/off. They detect how hard you\'re pressing.' },
          { text: 'float (0.0 to 1.0)', correct: true, explanation: 'Correct! Triggers return 0.0 (not pressed) to 1.0 (fully pressed). This lets you control speed based on how hard you squeeze.' },
          { text: 'String ("pressed" or "released")', correct: false, explanation: 'Gamepad inputs are always numeric or boolean, never Strings.' }
        ]
      }
    },
    {
      id: 'telemetry-debugging',
      title: 'Telemetry & Debugging',
      learn: 'When your robot is on the field, you can\'t plug in a monitor. Instead, use <strong>Telemetry</strong> to send text messages from the robot to the Driver Station screen. Call <code>telemetry.addData("Label", value)</code> for each piece of info, then <code>telemetry.update()</code> to actually send it.<br><br><strong>Critical:</strong> If you forget <code>telemetry.update()</code>, nothing appears on screen. It\'s like typing a text message but never hitting Send. Always put telemetry.update() at the END of your loop, after all your addData calls.',
      code: {
        language: 'java',
        snippet: `// Add data you want to see
telemetry.addData("Left Power", leftDrive.getPower());
telemetry.addData("Right Power", rightDrive.getPower());
telemetry.addData("Claw", clawServo.getPosition());

// SEND to the Driver Station screen — don't forget this!
telemetry.update();`
      },
      check: {
        question: 'You added three telemetry.addData() calls in your loop but nothing shows on the Driver Station. What did you forget?',
        type: 'multiple_choice',
        options: [
          { text: 'telemetry.send()', correct: false, explanation: 'The method is called update(), not send().' },
          { text: 'telemetry.update()', correct: true, explanation: 'Correct! addData() queues the information, but update() is what actually pushes it to the screen. Always call it once at the end of your loop.' },
          { text: 'telemetry.display()', correct: false, explanation: 'There is no display() method. The correct call is telemetry.update().' },
          { text: 'telemetry.refresh()', correct: false, explanation: 'The method is update(), not refresh(). Easy to mix up, but now you\'ll remember!' }
        ]
      },
      mentorTip: 'If you forget telemetry.update(), you\'ve basically typed out a whole text message but forgot to hit Send. Your future self will thank you for always putting it at the bottom of the loop.'
    }
  ];

  /* ══════════════════════════════════════════════════════════════════════════
     PHASE 2 LESSON CONTENT — "Make It Structured"
     ══════════════════════════════════════════════════════════════════════ */
  var PHASE_2_LESSONS = [
    {
      id: 'why-structure',
      title: 'Why Structure Matters',
      learn: 'In Phase 1, all your code lived in one file. That works when you\'re just spinning wheels. But imagine your robot now has a drivetrain, an intake, a shooter, and a lift — all in one 2,000-line file. If you fix a bug in the intake, you accidentally break the wheels. Programmers call this <strong>spaghetti code</strong>.<br><br>Good architecture is like organizing a giant bucket of Lego bricks into sorted bins. It makes code <strong>maintainable</strong> (finding bugs is 10x faster) and <strong>collaborative</strong> (one student programs the arm while another programs the wheels, without overwriting each other\'s work).',
      check: {
        question: 'Why is putting all robot code in one giant file a problem?',
        type: 'multiple_choice',
        options: [
          { text: 'It makes the code run slower on the Control Hub', correct: false, explanation: 'File size doesn\'t affect runtime speed. The problem is about organization and maintainability.' },
          { text: 'Fixing one mechanism can accidentally break another, and multiple students can\'t work simultaneously', correct: true, explanation: 'Correct! When everything is tangled together, changes in one area ripple unpredictably into others. And two students editing the same giant file will overwrite each other\'s work.' },
          { text: 'The FTC SDK has a file size limit', correct: false, explanation: 'There\'s no file size limit. The problem is purely about code organization.' },
          { text: 'Android Studio can\'t compile files over 500 lines', correct: false, explanation: 'Android Studio can handle any file size. The issue is human maintainability, not compiler limits.' }
        ]
      },
      mentorTip: 'Think of it like a restaurant kitchen. You don\'t have one chef cooking the steak, chopping the salad, baking the cake, and washing the dishes simultaneously. You divide into stations: Grill, Salad, Bakery. Each station is a subsystem.'
    },
    {
      id: 'subsystems-intro',
      title: 'What Is a Subsystem?',
      learn: 'A <strong>Subsystem</strong> is a separate Java class that controls one specific part of your robot. Instead of one giant blob, your robot becomes a team of specialists. Each subsystem contains three things:<br><br>1. <strong>Hardware variables</strong> — the motors, servos, and sensors that belong only to this mechanism<br>2. <strong>Initialization</strong> — the code that maps these to the Hardware Map<br>3. <strong>Action methods</strong> — commands that make the mechanism do things (e.g., <code>spinForward()</code>, <code>stop()</code>)<br><br>The main OpMode just calls simple commands like <code>spindexer.intake()</code>, and the subsystem handles all the motor logic behind the scenes.',
      code: {
        language: 'java',
        snippet: `public class Drivetrain {
    // Hardware belongs to this subsystem
    private DcMotor leftMotor;
    private DcMotor rightMotor;

    // Init links to Hardware Map
    public Drivetrain(HardwareMap hwMap) {
        leftMotor = hwMap.get(DcMotor.class, "left_drive");
        rightMotor = hwMap.get(DcMotor.class, "right_drive");
    }

    // Action methods — the only way to control this subsystem
    public void drive(double forward, double turn) {
        leftMotor.setPower(forward + turn);
        rightMotor.setPower(forward - turn);
    }
}`
      },
      check: {
        question: 'What three things should every subsystem class contain?',
        type: 'multiple_choice',
        options: [
          { text: 'Gamepad reading, motor control, and telemetry', correct: false, explanation: 'Subsystems should NEVER read gamepads directly. That\'s the OpMode\'s job.' },
          { text: 'Hardware variables, initialization, and action methods', correct: true, explanation: 'Correct! Hardware (private motors/servos), init (hardwareMap linking), and public methods (commands like drive(), stop()).' },
          { text: 'Comments, imports, and a main() method', correct: false, explanation: 'FTC classes don\'t have main() methods. Subsystems are about hardware control structure.' },
          { text: 'Autonomous, TeleOp, and configuration files', correct: false, explanation: 'Those are different parts of your project, not components of a single subsystem class.' }
        ]
      }
    },
    {
      id: 'hardware-isolation',
      title: 'The Golden Rule: Hardware Isolation',
      learn: 'Here is the most important rule of Phase 2: <strong>A subsystem should NEVER know that a gamepad exists.</strong><br><br>Why? Because you want to use the exact same subsystem code in both TeleOp and Autonomous. If you put <code>gamepad1.a</code> inside your Spindexer class, it crashes during Autonomous because there are no gamepads!<br><br>Instead, use a <strong>chain of command</strong>:<br>1. The <strong>OpMode</strong> reads the gamepad: "The driver pressed A"<br>2. The <strong>OpMode</strong> gives a generic order: "Hey Spindexer, turn on"<br>3. The <strong>Subsystem</strong> handles the hardware: "Setting spinMotor power to 0.8"',
      check: {
        question: 'Why should you NEVER put gamepad1.a inside a subsystem class?',
        type: 'multiple_choice',
        options: [
          { text: 'It makes the code too long', correct: false, explanation: 'Length isn\'t the issue. The problem is about reusability across match phases.' },
          { text: 'The subsystem will crash during Autonomous because gamepads don\'t exist in that phase', correct: true, explanation: 'Correct! Autonomous has no gamepads. If your subsystem references gamepad1, it throws a NullPointerException. Keep gamepad reading in the OpMode, keep hardware control in the subsystem.' },
          { text: 'Gamepads can only be read once per loop', correct: false, explanation: 'You can read gamepads as many times as you want. The issue is about subsystem portability.' },
          { text: 'Android Studio doesn\'t allow it', correct: false, explanation: 'The compiler won\'t stop you — the crash happens at runtime during an Autonomous match. That\'s worse.' }
        ]
      },
      mentorTip: 'If you find yourself typing "gamepad" inside a subsystem file, stop immediately. That\'s a code smell. The subsystem should only receive commands through its public methods, never read inputs directly.'
    },
    {
      id: 'encapsulation',
      title: 'Encapsulation: The Black Box Rule',
      learn: 'Encapsulation means <strong>hiding the messy details</strong>. Think about driving a car — you press the gas pedal, you don\'t manually inject fuel into cylinders. The engine is a "black box" with a clean interface.<br><br>In Java, we use two keywords:<br>&bull; <code>private</code> — only code inside THIS file can touch it<br>&bull; <code>public</code> — anyone can use it<br><br><strong>The rule:</strong> Hardware variables (motors, servos) are always <code>private</code>. Action methods are <code>public</code>. This way, the OpMode can\'t accidentally send a dangerous power level to a motor — it MUST use your safe methods.',
      code: {
        language: 'java',
        snippet: `public class Spindexer {
    // HIDDEN — OpMode cannot touch this directly
    private DcMotor spinMotor;

    public Spindexer(HardwareMap hwMap) {
        spinMotor = hwMap.get(DcMotor.class, "spin_motor");
    }

    // EXPOSED — the safe "gas pedal" the OpMode uses
    public void spinForward() {
        spinMotor.setPower(0.8);
    }

    public void stop() {
        spinMotor.setPower(0.0);
    }
}`
      },
      check: {
        question: 'What happens if a student writes myRobot.armMotor.setPower(1.0) and the arm motor is declared as private?',
        type: 'multiple_choice',
        options: [
          { text: 'It works normally', correct: false, explanation: 'Private means the motor can\'t be accessed from outside the class.' },
          { text: 'Android Studio shows a red error and refuses to compile', correct: true, explanation: 'Correct! The compiler blocks access to private fields from outside the class. The student is forced to use the public methods you designed, which can include safety checks.' },
          { text: 'The motor runs at half speed', correct: false, explanation: 'Private doesn\'t affect speed — it prevents access entirely.' },
          { text: 'It works but prints a warning', correct: false, explanation: 'Private access is not a warning — it\'s a hard compilation error. The code won\'t build at all.' }
        ]
      },
      mentorTip: 'Imagine the arm can only safely move 90 degrees. If the motor is public, someone can hold a button and snap the arm. If it\'s private, they MUST use your moveUp() method — which secretly checks the encoder and stops at 90 degrees.'
    },
    {
      id: 'enums',
      title: 'Enums: No More Magic Numbers',
      learn: 'Tracking what a mechanism is doing with an integer like <code>int mode = 3</code> is terrible — nobody knows what 3 means. Using a string like <code>"intake"</code> is better but dangerous — a typo like <code>"intak"</code> silently fails at competition.<br><br>An <strong>Enum</strong> is a custom type where YOU define the exact allowed options. If you typo it, Android Studio immediately underlines it in red and refuses to compile. It\'s like creating a dropdown menu for your code.',
      code: {
        language: 'java',
        snippet: `// Define the allowed states
public enum SpindexerState {
    IDLE,
    INTAKE,
    INDEXING,
    OUTTAKE
}

// Use it — typos are caught at compile time!
SpindexerState currentState = SpindexerState.IDLE;

// This would cause a red error:
// SpindexerState currentState = SpindexerState.INTAK;  // COMPILE ERROR`
      },
      check: {
        question: 'What advantage does an enum have over using a String like "intake" to track state?',
        type: 'multiple_choice',
        options: [
          { text: 'Enums use less memory', correct: false, explanation: 'Memory isn\'t the real benefit. The advantage is about catching errors early.' },
          { text: 'Enums are faster at runtime', correct: false, explanation: 'Speed difference is negligible. The real power is compile-time safety.' },
          { text: 'Typos in enum names are caught by the compiler before the code ever runs', correct: true, explanation: 'Correct! If you type SpindexerState.INTAK, Android Studio immediately flags it. With a String, "intak" compiles fine but silently fails during a match.' },
          { text: 'Enums can store more characters than Strings', correct: false, explanation: 'Strings can store unlimited text. Enums are about restricting options to a safe, defined set.' }
        ]
      }
    },
    {
      id: 'state-machines',
      title: 'State Machines: The Robot\'s Brain',
      learn: 'A <strong>State Machine</strong> lets your robot track what it\'s doing right now and transition logically to the next action. Think of a washing machine: FILL &rarr; WASH &rarr; RINSE &rarr; SPIN &rarr; OFF. It can\'t jump from OFF to SPIN.<br><br>In FTC, state machines solve the <strong>"no sleep" problem</strong>. Want the spindexer to spin forward for 2 seconds then reverse? With <code>sleep()</code>, your drivetrain freezes for 2 seconds. With a state machine, the spindexer just checks its enum every loop cycle: "Am I in INTAKE? Keep motor at 0.8." It never blocks anything.',
      code: {
        language: 'java',
        snippet: `public void update() {
    switch (currentState) {
        case IDLE:
            spinMotor.setPower(0.0);
            break;
        case INTAKE:
            spinMotor.setPower(0.8);
            break;
        case INDEXING:
            spinMotor.setPower(0.3);
            break;
        case OUTTAKE:
            spinMotor.setPower(-1.0);
            break;
    }
}`
      },
      check: {
        question: 'Why is a state machine better than using sleep(2000) to run a motor for 2 seconds?',
        type: 'multiple_choice',
        options: [
          { text: 'sleep() uses more battery', correct: false, explanation: 'Battery usage isn\'t the issue. The problem is about control flow.' },
          { text: 'State machines are easier to type', correct: false, explanation: 'They actually require more code. The benefit is functional, not syntactic.' },
          { text: 'sleep() blocks the ENTIRE loop — drivetrain, sensors, everything freezes for the duration', correct: true, explanation: 'Correct! During sleep(2000), the robot can\'t read gamepads, check sensors, or respond to Stop. A state machine checks state 50 times per second without ever blocking.' },
          { text: 'sleep() only works in Autonomous', correct: false, explanation: 'sleep() technically works anywhere, but it\'s dangerous in TeleOp because it freezes all controls.' }
        ]
      },
      mentorTip: 'The loop runs 50 times per second. Each cycle, the state machine just asks: "What state am I in? Do that thing." It\'s like a chef who checks their recipe card every few seconds instead of staring at the oven for 10 minutes straight.'
    },
    {
      id: 'robot-class',
      title: 'The Robot Class: Master Container',
      learn: 'If you have 5 subsystems, do you write setup code for all 5 in every TeleOp and Autonomous file? No! Create one <strong>Robot class</strong> that holds and initializes everything.<br><br>Think of it this way: subsystems are the kitchen stations (Grill, Salad, Bakery). The Robot class is the actual <strong>kitchen building</strong> that holds them all. One line in your OpMode brings the entire machine to life.',
      code: {
        language: 'java',
        snippet: `public class Robot {
    public Drivetrain drivetrain;
    public Spindexer spindexer;
    public Claw claw;

    // One constructor wakes up the entire robot
    public Robot(HardwareMap hwMap) {
        drivetrain = new Drivetrain(hwMap);
        spindexer = new Spindexer(hwMap);
        claw = new Claw(hwMap);
    }
}

// In your TeleOp — ONE line to init everything:
Robot robot = new Robot(hardwareMap);`
      },
      check: {
        question: 'What is the main benefit of a Robot class?',
        type: 'multiple_choice',
        options: [
          { text: 'It makes the code run faster', correct: false, explanation: 'Performance isn\'t the benefit. The Robot class is about organization.' },
          { text: 'It centralizes all subsystem initialization so you don\'t repeat setup code in every OpMode', correct: true, explanation: 'Correct! Without the Robot class, every TeleOp and Autonomous file would need 50 lines of identical setup code. With it, one line does everything.' },
          { text: 'It\'s required by the FTC SDK', correct: false, explanation: 'The Robot class is a design pattern, not an SDK requirement. But it\'s a best practice every competitive team uses.' },
          { text: 'It replaces the need for subsystem classes', correct: false, explanation: 'The Robot class CONTAINS subsystems — it doesn\'t replace them. You still need the individual subsystem classes.' }
        ]
      }
    },
    {
      id: 'clean-teleop',
      title: 'The Clean TeleOp: Zero Hardware Calls',
      learn: 'Here\'s the final test of good architecture: your TeleOp file should contain <strong>zero direct hardware calls</strong>. No <code>hardwareMap.get()</code>, no <code>setPower()</code>, no <code>setPosition()</code>. It only reads gamepads and calls subsystem methods.<br><br>If you can read your TeleOp and understand the robot\'s behavior without knowing anything about motors or servos, you\'ve achieved clean architecture. The TeleOp reads inputs, makes decisions, and delegates all hardware work to subsystems.',
      code: {
        language: 'java',
        snippet: `@TeleOp(name = "Clean TeleOp")
public class CleanTeleOp extends OpMode {
    Spindexer spindexer;

    public void init() {
        spindexer = new Spindexer(hardwareMap);
    }

    public void loop() {
        // Read gamepad, set state — NO motor calls here!
        if (gamepad1.a) {
            spindexer.setState(Spindexer.SpindexerState.INTAKE);
        } else if (gamepad1.b) {
            spindexer.setState(Spindexer.SpindexerState.OUTTAKE);
        } else {
            spindexer.setState(Spindexer.SpindexerState.IDLE);
        }

        // Let the subsystem handle the hardware
        spindexer.update();
    }
}`
      },
      check: {
        question: 'Which of these lines should NEVER appear in a well-structured TeleOp?',
        type: 'multiple_choice',
        options: [
          { text: 'robot.drivetrain.drive(forward, turn)', correct: false, explanation: 'This is perfect — it\'s calling a subsystem method, not touching hardware directly.' },
          { text: 'spindexer.setState(SpindexerState.INTAKE)', correct: false, explanation: 'This is correct — setting state through a public method is exactly right.' },
          { text: 'leftMotor.setPower(gamepad1.left_stick_y)', correct: true, explanation: 'Correct! This is a direct hardware call in the OpMode. The motor should be private inside a subsystem, and the OpMode should call a method like robot.drivetrain.drive() instead.' },
          { text: 'spindexer.update()', correct: false, explanation: 'Calling update() on a subsystem is the correct pattern — it tells the state machine to apply motor powers based on current state.' }
        ]
      },
      mentorTip: 'If the intake speed needs to change from 0.8 to 1.0, you don\'t hunt through thousands of lines of TeleOp. You open Spindexer.java, change one number in the INTAKE case, done. That\'s the power of architecture.'
    }
  ];

  /* ── Phase 3 Theory Lessons (written-answer checks, rendered before code lessons) ── */
  var PHASE_3_THEORY = [
    {
      id: 'theory-sensor-physics',
      title: 'Theory: What Sensors Actually Measure',
      isTheory: true,
      learn: 'A sensor doesn\u2019t tell you truth about the world. It gives you a <strong>number</strong> that is <strong>related</strong> to something physical \u2014 filtered through physics, electronics, and noise.<br><br>A color sensor has tiny photodiodes behind colored filters. When you call <code>colorSensor.red()</code> and get 180, that number depends on: how much red light the object reflects (what you care about), ambient room lighting (what you can\u2019t control), distance to the object (light drops with distance squared), sensor angle, and surface texture.<br><br>This is why the same red game element gives <code>red = 180</code> in your workshop but <code>red = 95</code> at competition \u2014 the gym lighting is completely different.',
      check: {
        question: 'A color sensor reads red = 200 in your workshop but red = 110 at competition, even though you\'re reading the exact same red game element. Explain at least two physical reasons why the reading changed, and why this means you can\'t use a simple threshold like if (red > 150) to detect red reliably.',
        type: 'written_answer',
        minLength: 50
      }
    },
    {
      id: 'theory-hsv-physics',
      title: 'Theory: Why HSV Beats RGB (The Physics)',
      isTheory: true,
      learn: 'RGB values change with lighting because they measure <strong>absolute light intensity</strong>. More ambient light = higher numbers across ALL channels.<br><br><strong>Hue</strong> (0-360\u00b0) is based on the <strong>ratio</strong> between RGB channels, not their absolute values. If your workshop has warm yellow lighting and the competition has cool fluorescents, absolute RGB changes dramatically \u2014 but the ratio stays roughly the same.<br><br>This is the same physics behind why your eyes can identify a red apple in sunlight, shade, or under fluorescent lights \u2014 your brain automatically adjusts for brightness and extracts the color ratio. <strong>Saturation</strong> tells you if it\u2019s a vivid color or just white/gray. <strong>Value</strong> tells you if the sensor sees something (bright) or empty air (dark).',
      check: {
        question: 'Explain in your own words why Hue is more stable than raw RGB values across different lighting conditions. Your answer should reference the fact that Hue is based on ratios rather than absolute values.',
        type: 'written_answer',
        minLength: 50
      }
    },
    {
      id: 'theory-noise',
      title: 'Theory: Signal vs Noise',
      isTheory: true,
      learn: 'Every sensor reading = <strong>signal</strong> (real value) + <strong>noise</strong> (random variation). Sources of noise in FTC: <strong>electronic noise</strong> (ADC precision limits cause \u00b11-3 count fluctuation), <strong>mechanical vibration</strong> (robot shakes while driving, sensor moves relative to surface), <strong>electromagnetic interference</strong> (spinning motors generate fields that induce currents in sensor wires).<br><br>A distance reading of 15.2cm means the wall is <strong>probably</strong> between 14.5-15.9cm. Next cycle it might read 14.8 or 15.5 even though nothing moved. Reacting to one reading is dangerous \u2014 one noisy spike of 8cm triggers your state transition when the wall is actually 14cm away.<br><br><strong>Filtering</strong> combats noise: threshold counting (require N consecutive readings), moving average (average last 5 readings), or exponential smoothing (<code>filtered = \u03b1 \u00d7 new + (1-\u03b1) \u00d7 previous</code>).',
      check: {
        question: 'Your distance sensor reads: 15, 14, 3, 15, 14, 10, 9, 8. The reading of 3 is clearly noise. Explain why a moving average filter would handle this better than reacting to individual readings. What would the moving average (window size 3) show at the point where the raw reading was 3?',
        type: 'written_answer',
        minLength: 50
      }
    },
    {
      id: 'theory-closed-loop-thinking',
      title: 'Theory: Open-Loop vs Closed-Loop Thinking',
      isTheory: true,
      learn: 'The difference between a beginner and a competition-ready programmer is how they think about <strong>uncertainty</strong>.<br><br><strong>Open-loop thinking:</strong> "Set motor to 0.5 for 2 seconds and the robot will drive 40 inches." Assumes the world is deterministic.<br><br><strong>Closed-loop thinking:</strong> "I want the robot at position (36, 72). I\u2019ll continuously measure where it actually is, compare to where I want it, and adjust." Accepts that the world is noisy and builds correction into the system.<br><br>Every time you write sensor code, ask: <strong>"What happens if this reading is wrong?"</strong> If the answer is "the robot does something dangerous or stupid," you need a fallback.',
      check: {
        question: 'Compare open-loop and closed-loop approaches to driving a robot to a specific position. Explain why the closed-loop approach is more reliable, and describe what the "loop" in "closed-loop" actually refers to physically \u2014 what information flows where?',
        type: 'written_answer',
        minLength: 50
      }
    }
  ];

  /* ══════════════════════════════════════════════════════════════════════════
     PHASE 3 LESSON CONTENT — "Make It Smart"
     ══════════════════════════════════════════════════════════════════════ */
  var PHASE_3_LESSONS = [
    {
      id: 'why-sensors',
      title: 'From Blind to Aware',
      learn: 'Up until now, your robot has been essentially blind. In TeleOp, the <em>human</em> is the sensor. In autonomous, without sensors, you\'re stuck writing code like <code>setPower(0.5); sleep(2000);</code> and <em>hoping</em> the robot ends up in the right spot.<br><br>This is called <strong>open-loop control</strong> — you send a command and assume the outcome is correct. But battery voltage changes, wheels slip on foam tiles, and other robots bump you. Sensors give your robot <strong>closed-loop awareness</strong>: instead of hoping, it <em>knows</em>.',
      check: {
        question: 'Why does time-based autonomous (sleep + fixed power) fail in competition?',
        type: 'multiple_choice',
        options: [
          { text: 'The field is too big for timed movements', correct: false, explanation: 'Field size isn\'t the issue — the problem is that identical motor power produces different distances under different conditions.' },
          { text: 'Battery voltage, wheel slip, and collisions all change how far the robot actually moves', correct: true, explanation: 'Correct! At full battery, 0.5 power drives 1.2 m/s. At half battery, same power gives 0.9 m/s. Your autonomous that worked in practice misses every target in competition.' },
          { text: 'The FTC SDK doesn\'t support sleep() in autonomous', correct: false, explanation: 'sleep() works in LinearOpMode. The problem isn\'t technical — it\'s that the real world is unpredictable.' },
          { text: 'Referees penalize robots that use timing', correct: false, explanation: 'There\'s no rule against it. The problem is reliability, not legality.' }
        ]
      }
    },
    {
      id: 'sensor-types',
      title: 'FTC Sensor Types',
      learn: 'FTC robots commonly use three sensor categories:<br><br><strong>Touch Sensors</strong> — the simplest. Returns <code>true</code> or <code>false</code>. Great for detecting when a mechanism hits a physical limit.<br><br><strong>Distance Sensors</strong> — returns a number in cm or inches. Detects walls, game elements, or alignment targets.<br><br><strong>Color Sensors</strong> — returns RGB values. Identifies game elements, detects field lines, sorts objects. Connecting them to code uses the same Hardware Map pattern from Phase 1.',
      code: {
        language: 'java',
        snippet: `// Declare — same pattern as motors
ColorSensor colorSensor;
DistanceSensor distanceSensor;
TouchSensor touchSensor;

// Map (inside init)
colorSensor = hardwareMap.get(ColorSensor.class, "color_sensor");
distanceSensor = hardwareMap.get(DistanceSensor.class, "distance_sensor");
touchSensor = hardwareMap.get(TouchSensor.class, "touch_sensor");

// Read values
boolean isPressed = touchSensor.isPressed();
double distanceCM = distanceSensor.getDistance(DistanceUnit.CM);
int red = colorSensor.red();
int blue = colorSensor.blue();`
      },
      check: {
        question: 'Which sensor type returns a boolean (true/false)?',
        type: 'multiple_choice',
        options: [
          { text: 'Color Sensor', correct: false, explanation: 'Color sensors return numeric RGB values (integers), not booleans.' },
          { text: 'Distance Sensor', correct: false, explanation: 'Distance sensors return a double (number in cm/inches), not a boolean.' },
          { text: 'Touch Sensor', correct: true, explanation: 'Correct! Touch sensors are the simplest — isPressed() returns true or false. That\'s it.' },
          { text: 'Encoder', correct: false, explanation: 'Encoders return integer tick counts, not booleans.' }
        ]
      }
    },
    {
      id: 'color-hsv',
      title: 'Color Detection: Use HSV, Not RGB',
      learn: 'Raw RGB values from a color sensor change dramatically based on lighting, distance, and surface texture. A value of <code>red = 180</code> might mean "red" in one room and "orange" in another.<br><br>The solution: convert to <strong>HSV</strong> (Hue, Saturation, Value). <strong>Hue</strong> is the actual color on a 0-360 degree wheel and is much more stable across lighting conditions. Red is roughly 0-30 or 330-360, Blue is roughly 200-260. Always test your thresholds at the actual competition venue.',
      code: {
        language: 'java',
        snippet: `// Convert RGB to HSV for stable color detection
float[] hsvValues = new float[3];
Color.RGBToHSV(
    colorSensor.red(),
    colorSensor.green(),
    colorSensor.blue(),
    hsvValues
);
float hue = hsvValues[0]; // 0-360 degrees

// Classify by hue range (with tolerance!)
if (hue > 5 && hue < 35) {
    // Red detected
} else if (hue > 200 && hue < 260) {
    // Blue detected
}`
      },
      check: {
        question: 'Why is HSV better than raw RGB for color detection in FTC?',
        type: 'multiple_choice',
        options: [
          { text: 'HSV uses less memory than RGB', correct: false, explanation: 'Both use similar memory. The advantage is about detection reliability, not performance.' },
          { text: 'Hue is stable across different lighting conditions, unlike raw RGB values', correct: true, explanation: 'Correct! Raw RGB changes with room brightness, distance to object, and surface texture. Hue (the actual color angle) stays consistent, making detection far more reliable at competition.' },
          { text: 'The FTC SDK only supports HSV', correct: false, explanation: 'The SDK supports both. HSV is a choice for reliability, not a requirement.' },
          { text: 'HSV can detect more colors than RGB', correct: false, explanation: 'Both represent the same color space. HSV just organizes it in a way that\'s easier to classify programmatically.' }
        ]
      },
      mentorTip: 'Always test your hue thresholds at the actual competition venue. The lighting at a school gym is very different from your workshop. Build in tolerance — don\'t check hue == 15, check hue > 5 && hue < 35.'
    },
    {
      id: 'sensor-decisions',
      title: 'Making Decisions with Sensor Data',
      learn: 'Reading a sensor is useless unless you <em>do something</em> with it. This is where state machines from Phase 2 become essential. Instead of a blocking <code>while</code> loop that freezes everything, use your state machine to check sensor values each cycle and transition when the condition is met.<br><br>The loop runs 50 times per second — each cycle, the state machine asks "what state am I in?" and "should I transition?" This means multiple subsystems work simultaneously.',
      code: {
        language: 'java',
        snippet: `switch (currentState) {
    case DRIVING_TO_WALL:
        drivetrain.drive(0.4, 0.0);
        if (distanceSensor.getDistance(DistanceUnit.CM) <= 10) {
            currentState = AutoState.AT_WALL;
        }
        break;

    case AT_WALL:
        drivetrain.stop();
        // React — pick up game element, change direction, etc.
        currentState = AutoState.DONE;
        break;

    case DONE:
        drivetrain.stop();
        break;
}`
      },
      check: {
        question: 'What is the advantage of checking sensor values inside a state machine vs. a while loop?',
        type: 'multiple_choice',
        options: [
          { text: 'State machines read sensors more accurately', correct: false, explanation: 'Both read the same sensor values. The advantage is about control flow, not sensor accuracy.' },
          { text: 'Nothing blocks — other subsystems can run simultaneously while waiting for the sensor condition', correct: true, explanation: 'Correct! A while loop blocks everything until the condition is met. A state machine checks the condition 50 times per second without stopping other subsystems from running.' },
          { text: 'State machines use less CPU', correct: false, explanation: 'CPU usage is similar. The benefit is that the loop keeps running for ALL subsystems, not just the one waiting on a sensor.' },
          { text: 'While loops don\'t work with sensors', correct: false, explanation: 'While loops work fine technically — the problem is they block everything else while waiting.' }
        ]
      }
    },
    {
      id: 'sensor-filtering',
      title: 'Sensor Filtering: Don\'t Trust One Reading',
      learn: 'Sensors are noisy. A distance sensor might read 15, 14, <strong>3</strong>, 15, 14 — that 3 was a glitch. If you react to every single reading, your robot behaves erratically.<br><br>The simplest fix is <strong>threshold counting</strong>: require multiple consecutive readings before triggering a state transition. This filters out single-frame glitches while still reacting quickly to real changes.',
      code: {
        language: 'java',
        snippet: `int closeReadingCount = 0;
int REQUIRED_COUNT = 3; // Need 3 in a row

// Inside DRIVING_TO_WALL state:
if (distanceSensor.getDistance(DistanceUnit.CM) <= 10) {
    closeReadingCount++;
    if (closeReadingCount >= REQUIRED_COUNT) {
        currentState = AutoState.AT_WALL;
    }
} else {
    closeReadingCount = 0; // Reset on a far reading
}`
      },
      check: {
        question: 'Your distance sensor reads: 15, 14, 3, 15, 14, 10, 9, 8. With REQUIRED_COUNT = 3, at which reading does the state transition trigger?',
        type: 'multiple_choice',
        options: [
          { text: 'At the "3" reading (first time below 10)', correct: false, explanation: 'The 3 is a single glitch. The counter goes to 1, then resets when the next reading is 15.' },
          { text: 'At the "8" reading (third consecutive reading below 10)', correct: true, explanation: 'Correct! The counter starts at 10 (count=1), then 9 (count=2), then 8 (count=3). Three consecutive readings below threshold triggers the transition. The glitch at 3 was correctly filtered out.' },
          { text: 'At the "10" reading', correct: false, explanation: 'That\'s only count=1. You need 3 consecutive readings below threshold.' },
          { text: 'It never triggers because the 3 was a glitch', correct: false, explanation: 'The 3 was indeed a glitch, but the three consecutive readings of 10, 9, 8 at the end are real and trigger the transition.' }
        ]
      }
    },
    {
      id: 'auto-structure',
      title: 'Autonomous Structure: State Machine Pattern',
      learn: 'For competition autonomous, use an <strong>Iterative OpMode with a state machine</strong>. It\'s more code upfront but much more powerful: non-blocking, multiple subsystems act at once, and it scales to complex routines.<br><br>Key patterns: use <code>ElapsedTime</code> instead of <code>sleep()</code>. Call <code>update()</code> on <strong>every</strong> subsystem <strong>outside</strong> the switch statement so they run regardless of which state you\'re in. Display current state via telemetry — always.',
      code: {
        language: 'java',
        snippet: `enum AutoPhase {
    DRIVE_FORWARD, SCAN_COLOR,
    REACT_TO_COLOR, PARK, DONE
}
AutoPhase phase = AutoPhase.DRIVE_FORWARD;
ElapsedTime timer = new ElapsedTime();

public void loop() {
    switch (phase) {
        case DRIVE_FORWARD:
            robot.drivetrain.drive(0.4, 0.0);
            if (distanceSensor.getDistance(DistanceUnit.CM) <= 15) {
                robot.drivetrain.stop();
                timer.reset();
                phase = AutoPhase.SCAN_COLOR;
            }
            break;
        // ... more states
    }

    // CRITICAL: update ALL subsystems every loop
    robot.drivetrain.update();
    robot.intake.update();
    telemetry.addData("Phase", phase);
    telemetry.update();
}`
      },
      check: {
        question: 'Where should subsystem update() calls go in an autonomous state machine?',
        type: 'multiple_choice',
        options: [
          { text: 'Inside each case of the switch statement', correct: false, explanation: 'If update() is only inside DRIVE_FORWARD, the intake won\'t respond in SCAN_COLOR. Every subsystem needs updating every cycle.' },
          { text: 'Outside the switch statement, so they run every loop regardless of state', correct: true, explanation: 'Correct! Subsystem update() calls go AFTER the switch, at the bottom of loop(). This ensures every subsystem runs its state machine every cycle, no matter which autonomous phase you\'re in.' },
          { text: 'In the init() method', correct: false, explanation: 'init() runs once before the match. update() needs to run 50 times per second during the match.' },
          { text: 'Only when the subsystem is actively being used', correct: false, explanation: 'Even "idle" subsystems need update() to maintain their state (like holding position or running a PID loop).' }
        ]
      },
      mentorTip: 'This season, a critical bug involved follower.update() being called both directly AND inside robot.periodic(). The robot got double-updated every cycle, causing erratic path following. Know exactly where your update() calls are.'
    },
    {
      id: 'common-pitfalls',
      title: 'Common Sensor Pitfalls',
      learn: 'Before building your deliverable, learn from mistakes already made:<br><br><strong>1. Hardware Map mismatch</strong> — still the #1 bug. Copy-paste names, never type from memory.<br><strong>2. "Works on the table" problem</strong> — always test on actual foam tiles, not with the robot lifted up.<br><strong>3. Single-reading trap</strong> — use threshold counting, never react to one sensor reading.<br><strong>4. Missing update() call</strong> — you set a subsystem state but nothing happens because update() isn\'t being called.<br><strong>5. Distance sensor angle</strong> — distance sensors measure in a cone, not a laser. A slight angle might detect the floor instead of the wall.',
      check: {
        question: 'You set spindexer.setState(INTAKE) but the motor doesn\'t spin. What\'s the most likely cause?',
        type: 'multiple_choice',
        options: [
          { text: 'The motor is broken', correct: false, explanation: 'Hardware failure is possible but rare. Check software first.' },
          { text: 'You forgot to call spindexer.update() in your loop', correct: true, explanation: 'Correct! setState() only changes the enum variable. The actual motor power is applied inside update() via the switch statement. If update() isn\'t called, the state changes but nothing happens physically.' },
          { text: 'The enum value is wrong', correct: false, explanation: 'Enums are type-safe — if INTAKE exists and you selected it, it\'s correct. The issue is that the state machine isn\'t being run.' },
          { text: 'The battery is too low', correct: false, explanation: 'Low battery would cause slow movement, not zero movement. A completely silent motor points to a code issue.' }
        ]
      }
    }
  ];

  /* ══════════════════════════════════════════════════════════════════════════
     PHASE 4 LESSON CONTENT — "Make It Precise"
     ══════════════════════════════════════════════════════════════════════ */
  /* ── Phase 4 Theory Lessons (written-answer checks, rendered before code lessons) ── */
  var PHASE_4_THEORY = [
    {
      id: 'theory-open-loop',
      title: 'Theory: Why Open-Loop Control Fails',
      isTheory: true,
      learn: 'Imagine throwing a basketball at a hoop <strong>with your eyes closed</strong>. You line up, throw with a specific force, and hope. That\u2019s <strong>open-loop control</strong> \u2014 executing a pre-planned action without checking the result.<br><br>In FTC, open-loop looks like <code>setPower(0.5); sleep(2000);</code> \u2014 run at 50% for 2 seconds and hope it\u2019s the right distance. It fails because:<br><br><strong>Battery voltage drops</strong> during a match (13.5V \u2192 12.0V), so the same power command produces different speeds. <strong>Friction varies</strong> across the field \u2014 dusty tiles vs clean tiles. <strong>Weight changes</strong> when you pick up game elements, shifting the center of gravity. Open-loop assumes a perfectly predictable world. The world is not predictable.',
      check: {
        question: 'Explain in 2-3 sentences why running a motor at 0.5 power for 2 seconds does NOT guarantee the robot travels the same distance every time. Mention at least two physical factors that cause variation.',
        type: 'written_answer',
        minLength: 50
      }
    },
    {
      id: 'theory-pid-physics',
      title: 'Theory: PID as Physical Forces',
      isTheory: true,
      learn: '<strong>P = A Spring.</strong> Attach a spring between your robot and the target. Far away \u2192 strong pull. Close \u2192 gentle pull. <code>force = kP \u00d7 error</code>. High kP = stiff spring (aggressive correction, might overshoot and oscillate). Low kP = loose spring (slow approach, might never arrive).<br><br><strong>D = A Shock Absorber.</strong> A spring alone oscillates \u2014 that\u2019s why cars have shock absorbers. D resists motion proportional to speed of approach. <code>braking = kD \u00d7 speed_of_approach</code>. It prevents the robot from blowing past the target.<br><br><strong>I = Impatience.</strong> Sometimes P gets you close but friction prevents the last bit of movement. I accumulates error over time, building up extra force until it pushes past friction. Danger: too much accumulation = <strong>integral windup</strong> = massive overshoot once the robot finally moves.<br><br><strong>F = Anti-Gravity.</strong> If an arm needs 0.15 power just to hold position against gravity, kF provides that baseline so PID only handles corrections. Remove the constant load so the fine-tuning system can focus.',
      check: {
        question: 'In your own words, explain what happens physically when kP is set too high on a drivetrain. Use the spring analogy \u2014 describe what a "too-stiff spring" does to the robot\'s motion and why it causes oscillation.',
        type: 'written_answer',
        minLength: 50
      }
    },
    {
      id: 'theory-odometry',
      title: 'Theory: How Odometry Tracks Position',
      isTheory: true,
      learn: 'Dead wheels are unpowered wheels with encoders that roll freely \u2014 no motor torque means no slip. Each loop cycle (50/sec), the system: reads encoder ticks \u2192 converts to distance \u2192 calculates heading change from left/right wheel difference \u2192 uses <strong>trigonometry</strong> to compute new (x, y).<br><br>The key math: <code>\u0394heading = (rightDistance - leftDistance) / trackWidth</code>. Then: <code>\u0394x = forwardDistance \u00d7 cos(heading)</code>, <code>\u0394y = forwardDistance \u00d7 sin(heading)</code>.<br><br><strong>Why calibration is critical:</strong> Heading calculation divides by track width. If track width is off by 1mm, every heading calculation is slightly wrong. Over 100 inches of driving, these errors <strong>compound</strong> \u2014 the robot thinks it\u2019s facing north when it\u2019s actually 5\u00b0 east. Then every position calculation uses the wrong heading for the trig, making (x, y) drift even on a straight path.',
      check: {
        question: 'A robot drives in a straight line for 100 inches, but the odometry track width is calibrated 2mm too wide. Explain what effect this has on the robot\'s reported heading over time, and why this heading error makes the reported (x, y) position drift even on a perfectly straight path.',
        type: 'written_answer',
        minLength: 50
      }
    },
    {
      id: 'theory-bezier',
      title: 'Theory: How Bezier Curves Work',
      isTheory: true,
      learn: 'A Bezier curve uses <strong>control points</strong> that shape the path like magnets \u2014 they pull the curve toward them without the robot passing through them.<br><br>The math is nested linear interpolation. For a straight line: <code>P(t) = (1-t)\u00d7A + t\u00d7B</code> where t goes from 0 to 1. For a curve with control point C: interpolate A\u2192C, then C\u2192B, then interpolate between those two results. The result is a smooth arc.<br><br><strong>Why this matters:</strong> Jerky paths (drive, stop, turn 90\u00b0, drive) waste time accelerating and decelerating at every corner. Bezier curves let the robot maintain speed through turns by following a continuous arc. Control point placement determines the shape: close to start = tight initial turn, far from path = wide dramatic arc.',
      check: {
        question: 'You have a start pose at (24, 24) and an end pose at (120, 24). You place a control point at (72, 96). Describe in words what shape the resulting Bezier curve will take \u2014 where does it start, which direction does it arc, and where does it end? Why would you choose this curve shape instead of a straight line?',
        type: 'written_answer',
        minLength: 50
      }
    },
    {
      id: 'theory-tuning',
      title: 'Theory: The Tuning Mindset',
      isTheory: true,
      learn: 'Tuning is NOT guessing. It\u2019s systematic:<br><br><strong>1. Start with P only</strong> (I, D, F = 0). Increase kP until the system reaches target but overshoots slightly. The spring is the right stiffness, just missing the damper.<br><strong>2. Add D</strong> to kill overshoot. Increase until the system settles cleanly. You\u2019ve added the shock absorber.<br><strong>3. Check for steady-state error.</strong> If consistently stopping short, friction is winning. Add small kI with an integral cap.<br><strong>4. Add F for constant loads.</strong> Measure hold power, set as kF.<br><br><strong>Golden rule:</strong> Change ONE constant at a time. Observe. If you change two things and it improves, you don\u2019t know which helped. Systematic isolation beats shotgunning.',
      check: {
        question: 'You\'re tuning a PID controller for a lift mechanism that holds a heavy arm. With kP = 0.05, the arm gets close to the target but stops about 8 degrees short and stays there. Explain which PID term(s) you would adjust and why, using the physical analogies (spring, damper, impatience, anti-gravity) to justify your answer.',
        type: 'written_answer',
        minLength: 50
      }
    }
  ];

  var PHASE_4_LESSONS = [
    {
      id: 'why-feedback',
      title: 'Why Timing-Based Control Fails',
      learn: 'In Phase 3, you used sensors for decisions, but driving was still primitive — set a power and hope. This is <strong>open-loop control</strong>.<br><br>Here\'s why it fails in competition: <strong>battery voltage drops</strong> (0.5 power gives 1.2 m/s at full charge, 0.9 m/s at half), <strong>wheels slip</strong> on dusty foam tiles, and <strong>weight changes</strong> when you pick up game elements. The solution is <strong>closed-loop control</strong>: measure where you actually are, compare to where you want to be, and adjust.',
      check: {
        question: 'Your autonomous works perfectly in practice but misses every target at competition. What is the most likely cause?',
        type: 'multiple_choice',
        options: [
          { text: 'The field is a different size at competition', correct: false, explanation: 'FTC fields are standardized. The dimensions are the same everywhere.' },
          { text: 'Battery voltage is different, causing the same motor power to produce different speeds', correct: true, explanation: 'Correct! A fully charged battery gives more voltage than a half-depleted one. Time-based autonomous that worked with a fresh battery overshoots or undershoots with a used one. This is why you need feedback control.' },
          { text: 'The competition Wi-Fi interferes with motor signals', correct: false, explanation: 'Motor signals are wired, not wireless. Wi-Fi only affects the Driver Station connection.' },
          { text: 'The referees started the match too early', correct: false, explanation: 'Match timing is standardized. The issue is with how the robot responds to identical commands under different conditions.' }
        ]
      }
    },
    {
      id: 'encoders',
      title: 'Encoders: Measuring Real Distance',
      learn: 'An <strong>encoder</strong> is a sensor built into a motor that counts "ticks" — tiny increments of rotation. A typical FTC motor has about 537.7 ticks per revolution. If you know your wheel circumference, you can calculate <em>exact</em> distance traveled.<br><br><strong>Important:</strong> Use <code>RUN_WITHOUT_ENCODER</code> mode and implement your own control. The SDK\'s <code>RUN_TO_POSITION</code> has an internal controller you can\'t tune, and it fights with external PID controllers and path following libraries.',
      code: {
        language: 'java',
        snippet: `// Reset encoder to zero
motor.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
motor.setMode(DcMotor.RunMode.RUN_WITHOUT_ENCODER);

// Read current position
int currentTicks = motor.getCurrentPosition();

// Convert ticks to distance
double TICKS_PER_REV = 537.7;
double WHEEL_DIAMETER_CM = 9.6;
double WHEEL_CIRCUMFERENCE = WHEEL_DIAMETER_CM * Math.PI;
double distanceCM = (currentTicks / TICKS_PER_REV) * WHEEL_CIRCUMFERENCE;`
      },
      check: {
        question: 'Why should you use RUN_WITHOUT_ENCODER instead of RUN_TO_POSITION for path following?',
        type: 'multiple_choice',
        options: [
          { text: 'RUN_TO_POSITION doesn\'t use encoders', correct: false, explanation: 'It does use encoders — it has its own internal controller. The problem is you can\'t tune or control that internal controller.' },
          { text: 'RUN_TO_POSITION has an internal controller that fights with your PID and path following library', correct: true, explanation: 'Correct! RUN_TO_POSITION uses an internal PIDF that you can\'t tune. If you also have your own PID or a path following library commanding motor powers, the two controllers fight each other, causing oscillation and erratic movement.' },
          { text: 'RUN_WITHOUT_ENCODER is faster', correct: false, explanation: 'Speed is the same. The issue is about control — who decides the motor power.' },
          { text: 'Encoders don\'t work in RUN_TO_POSITION mode', correct: false, explanation: 'Encoders work in both modes. The problem is that RUN_TO_POSITION takes over motor control, conflicting with external controllers.' }
        ]
      },
      mentorTip: 'This season, a spindexer used RUN_TO_POSITION combined with a custom PID. The two controllers fought — the motor oscillated wildly. The fix: strip out RUN_TO_POSITION and let the custom PID handle everything.'
    },
    {
      id: 'p-control',
      title: 'P Control: The Simplest Feedback Loop',
      learn: 'Proportional control is beautifully simple: <strong>the farther you are from the target, the harder you push</strong>.<br><br><code>error = target - current</code><br><code>output = kP * error</code><br><br>That\'s it. Far from target = large error = fast correction. Close to target = small error = gentle approach. The constant <code>kP</code> controls how aggressively the system corrects. Too low: never reaches the target. Too high: overshoots and oscillates.',
      code: {
        language: 'java',
        snippet: `double targetCM = 100.0;
double kP = 0.02;

// Inside your loop:
double currentCM = getDistanceTraveled();
double error = targetCM - currentCM;
double power = kP * error;

// Clamp to valid motor range
power = Math.max(-1.0, Math.min(1.0, power));
leftDrive.setPower(power);
rightDrive.setPower(power);

// Check if close enough (within 1cm)
if (Math.abs(error) < 1.0) {
    // Transition to next state
}`
      },
      check: {
        question: 'Your P controller has kP = 5.0 and the error is 20 ticks. What happens?',
        type: 'multiple_choice',
        options: [
          { text: 'The motor runs at exactly 100% power smoothly to the target', correct: false, explanation: 'kP * error = 5.0 * 20 = 100, clamped to 1.0. But when it overshoots, the error becomes negative, slamming the motor to -1.0. It oscillates violently.' },
          { text: 'The motor oscillates violently between full forward and full reverse', correct: true, explanation: 'Correct! Output = 5.0 * 20 = 100, clamped to 1.0. Motor runs full speed, overshoots, error goes negative, output clamps to -1.0, motor reverses full speed, undershoots — repeat forever. kP is WAY too high.' },
          { text: 'The motor barely moves because kP is too high', correct: false, explanation: 'High kP causes too much correction, not too little. The motor will slam to full power.' },
          { text: 'The motor reaches the target and stops perfectly', correct: false, explanation: 'With kP this high, the motor has far too much momentum when it reaches the target and overshoots dramatically.' }
        ]
      }
    },
    {
      id: 'pid-full',
      title: 'PID and PIDF: The Full Toolkit',
      learn: 'When P alone isn\'t enough, add more terms:<br><br><strong>I (Integral)</strong> — accumulates error over time. If P leaves you 5\u00b0 short because friction is too strong, I slowly builds up extra force to push through. Think of it as <em>impatience</em>.<br><br><strong>D (Derivative)</strong> — reacts to how fast the error is changing. If you\'re approaching the target quickly, D applies a braking force. Think of it as <em>looking ahead</em>.<br><br><strong>F (Feedforward)</strong> — a constant output for systems fighting gravity. If an arm needs 0.15 power just to hold position, kF provides that baseline.',
      code: {
        language: 'java',
        snippet: `// Full PIDF calculation
double error = target - current;
integralSum += error * loopTime;
double derivative = (error - lastError) / loopTime;

double output = (kP * error)
              + (kI * integralSum)
              + (kD * derivative)
              + kF;

lastError = error;

// TUNING ORDER:
// 1. Set kI, kD, kF to 0. Start with pure P.
// 2. Increase kP until it reaches target but overshoots slightly.
// 3. Add kD to dampen overshoot.
// 4. If steady-state error remains, add small kI.
// 5. If fighting gravity, add kF.`
      },
      check: {
        question: 'Your arm stops 5 degrees short of target because friction is too strong for P alone. Which term fixes this?',
        type: 'multiple_choice',
        options: [
          { text: 'Increase kP more', correct: false, explanation: 'More kP might help but also risks oscillation. The correct tool for steady-state error is the I term.' },
          { text: 'Add kD (Derivative)', correct: false, explanation: 'D provides braking, not extra pushing force. It would actually make the arm stop even shorter.' },
          { text: 'Add kI (Integral)', correct: true, explanation: 'Correct! The I term accumulates the small error over time, gradually building up enough extra force to push past friction. It\'s specifically designed for steady-state error where P alone isn\'t enough.' },
          { text: 'Add kF (Feedforward)', correct: false, explanation: 'Feedforward is for constant forces like gravity, not friction-based steady-state error. If the arm needs to hold against gravity, kF helps. For pushing past friction to reach a target, kI is the answer.' }
        ]
      },
      mentorTip: 'This season, a shooter\'s kP was ~50x too high, causing the motor to slam between +1.0 and -1.0 every cycle. The fix wasn\'t "add more D" — it was to reduce kP by 50x first, then tune from a sane baseline.'
    },
    {
      id: 'odometry',
      title: 'Odometry: Knowing Where You Are',
      learn: 'PID controls one axis. But autonomous needs your robot\'s full <strong>pose</strong> — its (x, y) position and heading on the field. Drive wheel encoders can estimate this, but wheel slip ruins accuracy.<br><br><strong>Dead wheels</strong> (odometry pods) solve this: unpowered wheels with encoders that roll freely on the ground. Because they\'re not driven, they don\'t slip. Two parallel wheels measure forward/backward and turning. One perpendicular wheel measures strafing. Together they track your pose every loop cycle.',
      check: {
        question: 'Why are dead wheels more accurate than drive wheel encoders for position tracking?',
        type: 'multiple_choice',
        options: [
          { text: 'Dead wheels have higher resolution encoders', correct: false, explanation: 'Resolution depends on the encoder model, not whether the wheel is driven. The key difference is about slip.' },
          { text: 'Dead wheels don\'t slip because they\'re not powered — drive wheels slip under acceleration', correct: true, explanation: 'Correct! Drive wheels slip when accelerating, decelerating, turning, or on dusty tiles. Dead wheels just roll freely, tracking actual ground movement without any slip from motor torque.' },
          { text: 'Dead wheels are connected directly to the Control Hub', correct: false, explanation: 'Both dead wheels and drive motors connect through the same encoder ports. The advantage is mechanical, not electrical.' },
          { text: 'The FTC SDK processes dead wheel data faster', correct: false, explanation: 'The SDK reads all encoders at the same rate. Dead wheels are more accurate because of the physics of unpowered rolling contact.' }
        ]
      }
    },
    {
      id: 'pedro-pathing',
      title: 'Pedro Pathing: Smooth Autonomous Paths',
      learn: 'Pedro Pathing lets you define smooth paths using <strong>Bezier curves</strong> instead of jerky "drive forward, turn, drive forward" sequences.<br><br><strong>BezierLine</strong> — straight line between two poses. <strong>BezierCurve</strong> — smooth arc using control points that "pull" the path without the robot passing through them.<br><br><strong>PathChains</strong> combine multiple segments. The <strong>Follower</strong> reads odometry, calculates how far off the path the robot is, and outputs motor corrections — like a 2D PID controller for position and heading simultaneously.',
      code: {
        language: 'java',
        snippet: `// Define waypoints as Poses (x, y, heading in radians)
Pose startPose = new Pose(24, 12, Math.toRadians(90));
Pose scorePose = new Pose(48, 72, Math.toRadians(135));

// Straight line path
PathChain scorePath = follower.pathBuilder()
    .addPath(new BezierLine(startPose, scorePose))
    .setLinearHeadingInterpolation(
        startPose.getHeading(), scorePose.getHeading())
    .build();

// Curved path with control point
Pose controlPt = new Pose(45, 60, 0);
Pose pickupPose = new Pose(21, 75, Math.toRadians(180));

PathChain pickupPath = follower.pathBuilder()
    .addPath(new BezierCurve(scorePose, controlPt, pickupPose))
    .setLinearHeadingInterpolation(
        scorePose.getHeading(), pickupPose.getHeading())
    .build();`
      },
      check: {
        question: 'What does a control point in a BezierCurve do?',
        type: 'multiple_choice',
        options: [
          { text: 'The robot drives to the control point, stops, then continues to the end', correct: false, explanation: 'The robot never passes through the control point. It only influences the shape of the curve.' },
          { text: 'It "pulls" the path into a smooth arc without the robot actually passing through it', correct: true, explanation: 'Correct! Control points act like magnets that bend the path into a curve. The robot follows the smooth arc but never visits the control point itself. This creates natural, flowing movement.' },
          { text: 'It sets the speed of the robot at that point', correct: false, explanation: 'Speed is controlled by the follower\'s PID, not by control points. Control points only affect the shape of the path.' },
          { text: 'It tells the robot which direction to face', correct: false, explanation: 'Heading is set by setLinearHeadingInterpolation(), not by control points. Control points only affect the spatial curve.' }
        ]
      }
    },
    {
      id: 'follower-rules',
      title: 'Critical Follower Rules',
      learn: 'These rules will save you hours of debugging:<br><br><strong>1.</strong> Call <code>follower.update()</code> exactly <strong>once</strong> per loop. Not zero, not twice. A double update doubles all PID corrections, causing oscillation.<br><strong>2.</strong> Don\'t set motor powers directly while the follower is running — it fights the follower.<br><strong>3.</strong> Always set heading interpolation, or the robot may spin unexpectedly during curves.<br><strong>4.</strong> Use <code>followPath(path, true)</code> — the <code>true</code> means hold position at the end.<br><strong>5.</strong> Call <code>setStartingPose()</code> before building any paths.',
      check: {
        question: 'Your path following is erratic — the robot overshoots every waypoint. You check and find follower.update() is called in your loop AND inside robot.periodic(). What\'s the fix?',
        type: 'multiple_choice',
        options: [
          { text: 'Add more kD to compensate for the extra updates', correct: false, explanation: 'Adding D treats the symptom, not the cause. The root problem is double-updating.' },
          { text: 'Remove one of the two update() calls so it runs exactly once per loop', correct: true, explanation: 'Correct! Two update() calls means double PID correction every cycle, which is equivalent to doubling all your PID constants. Remove the duplicate so the follower updates exactly once.' },
          { text: 'Reduce the loop speed to 25 Hz', correct: false, explanation: 'Slowing the loop doesn\'t fix the double-update problem — it just makes it oscillate more slowly.' },
          { text: 'Increase the path tolerance', correct: false, explanation: 'Larger tolerance would make it less precise, but the oscillation from double-updating would still happen.' }
        ]
      },
      mentorTip: 'This season, the robot kept colliding with walls during path following. Everyone blamed the library. The root cause was kF set ~40x too high in the drive constants. Lesson: when path following fails, check your constants before blaming the library.'
    },
    {
      id: 'tuning-process',
      title: 'Practical Tuning Process',
      learn: 'Don\'t guess. Follow this order:<br><br><strong>1. Calibrate odometry first.</strong> Push robot 48 inches — does odometry report 48? Turn 360\u00b0 — does heading return to 0? Fix these before anything else.<br><strong>2. Tune translational PID.</strong> Straight line forward. Increase kP until it reaches target, add kD for overshoot.<br><strong>3. Tune heading PID.</strong> Turn in place to a target heading. Same process.<br><strong>4. Test simple paths first.</strong> One straight line. Then one curve. Then two chained segments. Build complexity gradually.<br><strong>5. Consistency test.</strong> Run the path 5 times. Same spots every time = success.',
      check: {
        question: 'Your robot follows paths but drifts slightly left over long distances. What should you check FIRST?',
        type: 'multiple_choice',
        options: [
          { text: 'Heading PID constants', correct: false, explanation: 'PID tuning is step 2-3. The most common cause of consistent drift is a calibration error, not a tuning problem.' },
          { text: 'Odometry calibration — specifically the dead wheel track width measurement', correct: true, explanation: 'Correct! Consistent drift in one direction usually means your track width (distance between left and right dead wheels) is slightly wrong. Even 1mm of error compounds into heading drift over long paths. Calibrate first, tune second.' },
          { text: 'Motor directions', correct: false, explanation: 'Wrong motor directions cause obvious problems (spinning in circles), not subtle drift. Drift is almost always a calibration issue.' },
          { text: 'Battery voltage', correct: false, explanation: 'Low battery causes slower movement, not directional drift. Consistent left drift points to a mechanical or calibration issue.' }
        ]
      }
    }
  ];

  /* ── Phase 5 Theory Lessons (written-answer checks, rendered before code lessons) ── */
  var PHASE_5_THEORY = [
    {
      id: 'theory-scientific-debugging',
      title: 'Theory: Debugging IS the Scientific Method',
      isTheory: true,
      learn: 'Random mutation debugging \u2014 changing things randomly until it works \u2014 is like a scientist randomly mixing chemicals. Even when it accidentally works, you don\u2019t know why, so the same bug class reappears.<br><br>The scientific method for debugging: <strong>1. Observe</strong> (what exactly happens \u2014 not "it doesn\u2019t work"), <strong>2. Hypothesize</strong> (list at least 3 possible causes before touching code), <strong>3. Predict & Test</strong> (test each hypothesis WITHOUT changing code \u2014 use telemetry), <strong>4. Isolate</strong> (narrow down by eliminating hypotheses), <strong>5. Fix</strong> (ONE change for the confirmed cause), <strong>6. Verify</strong> (confirm fix works AND nothing else broke).',
      check: {
        question: 'Your robot\'s arm motor doesn\'t move when you press the A button. List three different hypotheses for why this might be happening (they should be meaningfully different \u2014 not three variations of the same idea). For each hypothesis, describe one test you could perform WITHOUT changing code to confirm or eliminate it.',
        type: 'written_answer',
        minLength: 80
      }
    },
    {
      id: 'theory-bug-taxonomy',
      title: 'Theory: The Taxonomy of Bugs',
      isTheory: true,
      learn: 'Not all bugs are the same. The <strong>category</strong> tells you where to look:<br><br><strong>Configuration bugs</strong> \u2014 code is correct but references wrong things. Hardware Map mismatches, wrong motor direction. Cause immediate crashes or obvious wrong behavior. Easiest to find.<br><br><strong>Logic bugs</strong> \u2014 code doesn\u2019t crash but does the wrong thing. Wrong state transitions, bad PID constants, wrong comparisons. No error message \u2014 code does exactly what you told it, which isn\u2019t what you wanted.<br><br><strong>Timing bugs</strong> \u2014 works sometimes, not always. Race conditions, wrong ordering, sensors checked before stabilizing. Hardest because they\u2019re intermittent.<br><br><strong>Integration bugs</strong> \u2014 two pieces work alone but break together. Two controllers fighting over one motor, double update() calls. Only appear when the full system is assembled.',
      check: {
        question: 'You encounter a bug where your autonomous works perfectly 8 out of 10 times, but occasionally the robot stops mid-path and doesn\'t continue. Which category of bug is this most likely to be? Explain your reasoning and describe what debugging approach you would take based on that category.',
        type: 'written_answer',
        minLength: 50
      }
    },
    {
      id: 'theory-root-cause',
      title: 'Theory: Root Cause vs Symptom',
      isTheory: true,
      learn: 'The most important debugging skill: distinguish between <strong>symptom</strong> (what you see) and <strong>root cause</strong> (why it happens).<br><br><strong>Example:</strong> Robot overshoots scoring position by 6 inches. Tempting fix: reduce target by 6 inches. Why this is wrong: tomorrow with a different battery, it overshoots by 4 inches \u2014 your offset is now wrong. Root cause: kP is too high. Real fix: tune kP properly.<br><br><strong>The "5 Whys" technique:</strong> Keep asking "why?" until you reach the actual cause. Why did it overshoot? Going too fast near target. Why? High motor power. Why? kP \u00d7 error still produces high output at small errors. Why? kP is too large. Fix at level 4, not level 1.',
      check: {
        question: 'A team notices their robot\'s intake motor sometimes doesn\'t respond to button presses. They "fix" it by adding a 200ms sleep() after each button check to "give the motor time to respond." Explain why this is a symptom fix and not a root cause fix. What would you investigate to find the actual root cause?',
        type: 'written_answer',
        minLength: 50
      }
    },
    {
      id: 'theory-triage',
      title: 'Theory: Competition Triage',
      isTheory: true,
      learn: 'At competition, you have 5 minutes to diagnose and fix. Most failures have simple causes \u2014 start simple, work up.<br><br><strong>30-second checks:</strong> Connected? Correct OpMode? Init AND Start pressed? Cables seated?<br><strong>2-minute checks:</strong> Read error message. Hardware Map error? NullPointerException? What state is telemetry showing?<br><strong>5-minute checks:</strong> Add telemetry to broken method. Check motor directions. Check sensor values. Verify update() calls.<br><strong>Nuclear option:</strong> Revert to working code. Disable broken subsystem. Use backup autonomous.<br><br><strong>Most important rule:</strong> Always have a backup autonomous. Dead-simple drive-forward-and-park. Zero sensors, zero path following. If everything fails, this gets parking points. Something beats nothing.',
      check: {
        question: 'You\'re at competition. Your autonomous was working perfectly during practice matches, but in your first qualification match, the robot initializes and then does nothing when Start is pressed. You have 4 minutes until your next match. Walk through your diagnostic process step by step \u2014 what do you check first, second, and third? What\'s your fallback plan if you can\'t find the bug in time?',
        type: 'written_answer',
        minLength: 80
      }
    }
  ];

  /* ══════════════════════════════════════════════════════════════════════════
     PHASE 5 LESSON CONTENT — "Make It Robust"
     ══════════════════════════════════════════════════════════════════════ */
  var PHASE_5_LESSONS = [
    {
      id: 'debugging-mindset',
      title: 'The Debugging Mindset',
      learn: 'The biggest mistake in debugging is <strong>random mutation</strong> — changing things randomly and re-running until it works. Even when it accidentally works, you don\'t know <em>why</em>, so the same class of bug appears again.<br><br>The process: <strong>1. Observe</strong> (what exactly happens — not "it doesn\'t work"), <strong>2. Hypothesize</strong> (list at least 3 possible causes before touching code), <strong>3. Test</strong> (confirm or eliminate hypotheses without changing code — use telemetry), <strong>4. Fix</strong> (one change at a time), <strong>5. Verify</strong> (confirm the fix works and didn\'t break anything else).',
      check: {
        question: 'Your arm motor isn\'t moving. What should you do FIRST?',
        type: 'multiple_choice',
        options: [
          { text: 'Change the motor power value and re-run', correct: false, explanation: 'That\'s random mutation. You don\'t know if the problem is power, wiring, configuration, or code logic.' },
          { text: 'Observe exactly what happens, then list at least 3 possible causes before touching any code', correct: true, explanation: 'Correct! Does the motor make noise but not move (mechanical jam)? Is there zero response (wiring or config)? Does telemetry show power being set (code is fine, hardware issue)? Listing hypotheses before changing code saves hours.' },
          { text: 'Rewrite the entire subsystem from scratch', correct: false, explanation: 'Nuclear option. You\'d throw away working code and likely introduce new bugs. Diagnose first.' },
          { text: 'Ask your mentor to fix it', correct: false, explanation: 'Your mentor will ask you the same diagnostic questions. Learn to answer them yourself — that\'s what this phase is about.' }
        ]
      }
    },
    {
      id: 'observability',
      title: 'Building Observability',
      learn: '<strong>If you can\'t see it, you can\'t fix it.</strong> A robot without telemetry is like debugging code without print statements — you\'re flying blind. Every subsystem, every state machine, every sensor reading should be visible.<br><br>Key things to always display: current state machine state, motor powers being sent, sensor values, loop time (if above 50ms something is blocking your loop), and encoder positions.',
      code: {
        language: 'java',
        snippet: `// BAD: Generic, unhelpful
telemetry.addData("Status", "Running");

// GOOD: Specific, actionable
telemetry.addData("Auto State", currentPhase);
telemetry.addData("Drive | L/R Power", "%.2f / %.2f",
    leftPower, rightPower);
telemetry.addData("Pose | X, Y, H", "%.1f, %.1f, %.1f",
    pose.getX(), pose.getY(),
    Math.toDegrees(pose.getHeading()));
telemetry.addData("Intake State", intake.getCurrentState());
telemetry.addData("Loop Time (ms)", "%.1f",
    loopTimer.milliseconds());`
      },
      check: {
        question: 'Your autonomous gets stuck and you see "Auto State: DRIVE_FORWARD" frozen on telemetry. What does this tell you?',
        type: 'multiple_choice',
        options: [
          { text: 'The telemetry is broken', correct: false, explanation: 'If telemetry were broken, you\'d see nothing at all. The fact that it shows a frozen state means telemetry is working fine.' },
          { text: 'The state machine is stuck in DRIVE_FORWARD — the transition condition is never being met', correct: true, explanation: 'Correct! The state machine checks a condition to transition out of DRIVE_FORWARD (like a distance threshold). That condition is never true — maybe the sensor is disconnected, the threshold is wrong, or the robot isn\'t actually moving. Next step: add telemetry for the sensor value and motor powers inside that state.' },
          { text: 'The robot\'s Wi-Fi disconnected', correct: false, explanation: 'If Wi-Fi disconnected, the Driver Station would show a disconnect warning, not frozen telemetry.' },
          { text: 'The loop stopped running', correct: false, explanation: 'If the loop stopped, telemetry would stop updating entirely. A frozen state value means the loop IS running but the state isn\'t changing.' }
        ]
      }
    },
    {
      id: 'bug-silent-return',
      title: 'Bug Pattern: The Silent Return',
      learn: '<strong>Symptom:</strong> A method is called but nothing happens. No crash, no error, just... nothing.<br><br><strong>Root cause:</strong> A guard condition at the top of the method returns early before the actual logic runs. If the subsystem is in <em>any</em> state other than what the guard expects, the method silently does nothing.<br><br><strong>How to spot it:</strong> Add telemetry at the entry point of every important method. If the method is called but telemetry after the guard never appears, you\'ve found your ghost.',
      code: {
        language: 'java',
        snippet: `public void rotateTo(double targetAngle) {
    // This guard silently kills the method!
    if (currentState != SpindexerState.IDLE) return;

    // This code NEVER runs if state isn't IDLE
    spinMotor.setTargetPosition(targetAngle);
    spinMotor.setPower(0.5);
}

// FIX: Add logging to see when the guard triggers
public void rotateTo(double targetAngle) {
    if (currentState != SpindexerState.IDLE) {
        telemetry.addData("WARNING",
            "rotateTo blocked — state is " + currentState);
        return;
    }
    spinMotor.setTargetPosition(targetAngle);
    spinMotor.setPower(0.5);
}`
      },
      check: {
        question: 'You call spindexer.rotateTo(90) but nothing happens. Telemetry shows "WARNING: rotateTo blocked — state is INTAKE". What\'s the fix?',
        type: 'multiple_choice',
        options: [
          { text: 'Remove the guard condition entirely', correct: false, explanation: 'The guard might exist for a good reason (safety). Removing it could cause the motor to rotate while intaking, which might jam.' },
          { text: 'Make sure the spindexer is set to IDLE before calling rotateTo()', correct: true, explanation: 'Correct! The calling code needs to transition the spindexer to IDLE first, then call rotateTo(). The guard is protecting the mechanism — the fix is in the caller, not the guard.' },
          { text: 'Change the guard to check for INTAKE instead of IDLE', correct: false, explanation: 'That would let rotation happen during intake, which is probably dangerous. The guard logic is correct — the calling sequence is wrong.' },
          { text: 'Add a sleep(500) before the call', correct: false, explanation: 'Sleeping doesn\'t change the state. The spindexer will still be in INTAKE after the sleep.' }
        ]
      }
    },
    {
      id: 'bug-double-update',
      title: 'Bug Pattern: The Double Update',
      learn: '<strong>Symptom:</strong> Path following is erratic. Robot overshoots, oscillates, or moves at double speed.<br><br><strong>Root cause:</strong> <code>follower.update()</code> is called twice per loop — once directly and once inside a method like <code>robot.periodic()</code>. Each call calculates motor powers, so two calls means double correction — equivalent to doubling all PID constants.<br><br><strong>How to spot it:</strong> Search your ENTIRE codebase for every <code>.update()</code> call. If any subsystem is updated in more than one place, that\'s your bug.',
      check: {
        question: 'Your robot oscillates wildly during path following. You search the codebase and find follower.update() in two places. What do you do?',
        type: 'multiple_choice',
        options: [
          { text: 'Reduce all PID constants by half to compensate', correct: false, explanation: 'That treats the symptom, not the cause. You\'d have to remember this hack forever, and it breaks if you ever fix the real problem.' },
          { text: 'Remove one of the two update() calls', correct: true, explanation: 'Correct! The follower should be updated exactly once per loop cycle. Remove the duplicate. If it\'s inside robot.periodic(), either remove it there or remove the direct call — but never both.' },
          { text: 'Add a boolean flag to skip every other update', correct: false, explanation: 'Creative but wrong. You\'d be running at half the update rate, which introduces its own control problems. Just remove the duplicate.' },
          { text: 'Switch to a different path following library', correct: false, explanation: 'The library is fine. The bug is in how you\'re calling it. Switching libraries would just move the problem.' }
        ]
      },
      mentorTip: 'Use your IDE\'s "Find All References" feature on update(). If it shows up in more than one place for the same subsystem, you\'ve found trouble.'
    },
    {
      id: 'bug-kp-catastrophe',
      title: 'Bug Pattern: The kP Catastrophe',
      learn: '<strong>Symptom:</strong> Motor slams to full power, oscillates violently between +1.0 and -1.0, or vibrates audibly.<br><br><strong>Root cause:</strong> kP is orders of magnitude too high. A kP of 50 when the correct value is ~1.0 means any small error (even 2 ticks) produces output greater than 1.0, saturating the motor at maximum power every single cycle.<br><br><strong>The fix:</strong> Start with a very small kP and increase gradually. If a motor is oscillating between extremes, kP is too high. If it barely moves, kP is too low.',
      code: {
        language: 'java',
        snippet: `// kP = 50 (WAY too high, should be ~1.0)
// Error of 20 ticks:
//   output = 50 * 20 = 1000 → clamped to 1.0
//   Motor runs full speed, overshoots
//   New error = -15 ticks:
//   output = 50 * -15 = -750 → clamped to -1.0
//   Motor reverses full speed, undershoots
//   Repeat forever!

// FIX: Start small, increase gradually
double kP = 0.01; // Start here
// Test → too slow? Try 0.05
// Test → reaches target but overshoots? Add kD
// Test → perfect? Done.`
      },
      check: {
        question: 'A motor vibrates audibly and telemetry shows power alternating between 1.0 and -1.0 every cycle. What\'s wrong?',
        type: 'multiple_choice',
        options: [
          { text: 'The motor is physically damaged', correct: false, explanation: 'Physical damage causes grinding or no movement. Rapid alternation between full forward and reverse is a control problem.' },
          { text: 'kP is far too high, causing the controller to overcorrect every cycle', correct: true, explanation: 'Correct! Any error, no matter how small, produces max output. The motor overshoots, reverses, overshoots again. The fix: reduce kP dramatically (often by 10-50x) and tune up gradually from a stable baseline.' },
          { text: 'The encoder is reading backwards', correct: false, explanation: 'A reversed encoder would cause the motor to run away in one direction, not oscillate between two directions.' },
          { text: 'kD is too low', correct: false, explanation: 'Adding D to an already-unstable system can help, but the root cause is kP being too high. Fix kP first, then tune D.' }
        ]
      }
    },
    {
      id: 'diagnostic-checklist',
      title: 'The Diagnostic Checklist',
      learn: 'At competition, you don\'t have time for leisurely investigation. Use this tiered checklist:<br><br><strong>Tier 1 (30 seconds):</strong> Is robot connected? Correct OpMode selected? Init AND Start pressed? Cables seated?<br><strong>Tier 2 (2 minutes):</strong> Read the error message. Hardware Map error? NullPointerException? Check telemetry — what state is it stuck in?<br><strong>Tier 3 (5 minutes):</strong> Add telemetry to the broken method. Check motor directions. Check sensor values. Verify update() calls.<br><strong>Tier 4 (last resort):</strong> Revert to last working code. Disable broken subsystem. Use backup autonomous.',
      check: {
        question: 'The robot crashes on Init with "device not found: left_Drive". Where do you look?',
        type: 'multiple_choice',
        options: [
          { text: 'Check if the motor is physically plugged in and the Hardware Map name matches exactly (including capitalization)', correct: true, explanation: 'Correct! "left_Drive" with a capital D won\'t match "left_drive" in the config. This is a Tier 1/2 check — takes 30 seconds to verify. Copy-paste names from the configuration, never type from memory.' },
          { text: 'Reinstall the FTC SDK', correct: false, explanation: 'The SDK is fine. "Device not found" always means a name mismatch or unplugged hardware. Check the simple things first.' },
          { text: 'Rewrite the Hardware Map initialization code', correct: false, explanation: 'The code structure is probably fine — just the string name is wrong. A one-character fix, not a rewrite.' },
          { text: 'Replace the motor', correct: false, explanation: 'Hardware replacement is a last resort. A "device not found" error is always a configuration/naming issue, not a hardware failure.' }
        ]
      }
    },
    {
      id: 'failsafes',
      title: 'Fail-Safes and Graceful Degradation',
      learn: 'Good competition code handles failure <strong>gracefully</strong>. If the color sensor dies, your autonomous should still park. If path following loses odometry, switch to timed driving. Something is always better than nothing — and nothing is what you get when the robot crashes.<br><br>Build checks for sensor garbage (NaN, impossibly large values) and fall back to simpler strategies instead of crashing. The goal isn\'t perfection — it\'s <strong>graceful degradation</strong>.',
      code: {
        language: 'java',
        snippet: `// Instead of crashing on bad sensor data:
double distance = distanceSensor.getDistance(DistanceUnit.CM);

if (Double.isNaN(distance) || distance > 300) {
    // Sensor disconnected or reading garbage
    telemetry.addData("WARNING", "Distance sensor unreliable!");
    useTimerFallback = true;
}

// Fallback: if sensor dies, use timer-based driving
if (useTimerFallback) {
    if (timer.seconds() < 2.0) {
        drivetrain.drive(0.3, 0);
    } else {
        drivetrain.stop();
    }
}`
      },
      check: {
        question: 'Your color sensor returns NaN during autonomous. What should your code do?',
        type: 'multiple_choice',
        options: [
          { text: 'Crash with an error so the driver knows something is wrong', correct: false, explanation: 'Crashing means the robot does NOTHING for the rest of autonomous. Zero points. A fallback strategy gets you some points.' },
          { text: 'Keep trying to read the sensor until it works', correct: false, explanation: 'If the sensor is disconnected, it will never work. You\'d be stuck in an infinite loop while the match timer ticks away.' },
          { text: 'Fall back to a simpler strategy — skip the color-dependent action and park for guaranteed points', correct: true, explanation: 'Correct! Graceful degradation means doing the best you can with what\'s working. Parking is worth points. Color-based scoring is worth more points, but zero points from a crash is the worst outcome.' },
          { text: 'Ignore the NaN and use the value anyway', correct: false, explanation: 'NaN propagates through math — any calculation with NaN produces NaN. Your motor powers would become NaN, which the SDK treats as 0. The robot freezes.' }
        ]
      },
      mentorTip: 'At competition, your backup autonomous should be dead simple: drive forward, park. No sensors, no path following, just motor power and a timer. If everything else fails, this gets you parking points. Always have it ready.'
    },
    {
      id: 'pre-match',
      title: 'Pre-Match Checklist',
      learn: 'Before every match, run through this:<br><br>\u2022 Battery above 13.0V (check with Driver Station)<br>\u2022 Correct autonomous selected<br>\u2022 All motors spin freely (no physical obstructions)<br>\u2022 All sensors returning sane values (check telemetry during Init)<br>\u2022 Robot placed in exact starting position (use alignment marks)<br>\u2022 Gamepads connected and mapped correctly<br><br>This takes 60 seconds and prevents the most common competition failures. Teams that skip this step lose matches to preventable problems.',
      check: {
        question: 'Your battery reads 11.8V before a match. What should you do?',
        type: 'multiple_choice',
        options: [
          { text: 'It\'s fine — the robot will work at slightly lower speed', correct: false, explanation: '11.8V is dangerously low. Your autonomous will undershoot every target, and the robot may brown out (lose power) mid-match.' },
          { text: 'Swap to a fully charged battery immediately', correct: true, explanation: 'Correct! 13.0V is the minimum for reliable operation. Below that, motor performance degrades unpredictably and the robot risks browning out during high-current actions like driving and shooting simultaneously.' },
          { text: 'Lower all motor powers in code to compensate', correct: false, explanation: 'You don\'t have time to retune all your constants before a match. And lower powers mean slower, less competitive performance. Just swap the battery.' },
          { text: 'Tell the drivers to go easy on the controls', correct: false, explanation: 'Drivers shouldn\'t have to compensate for hardware problems. A fresh battery costs 30 seconds to swap and solves the problem completely.' }
        ]
      },
      mentorTip: 'The best teams at competition have a laminated checklist taped to their pit table. They run through it before EVERY match, even when they\'re rushed. The 60 seconds it takes has saved more matches than any amount of code optimization.'
    }
  ];

  /* ══════════════════════════════════════════════════════════════════════════
     ADVANCED MODULE 1 — Command-Based Programming
     ══════════════════════════════════════════════════════════════════════ */
  var ADVANCED_1_CONTENT = {
    type: 'advanced',
    title: 'Command-Based Programming',
    estimatedTime: '20 minutes',
    sections: [
      {
        title: 'Why Command-Based?',
        content: 'In Phases 2-5, you built subsystems with state machines and called <code>update()</code> every loop. This works well for simple robots. But as your robot gets more complex — 6+ subsystems, multi-step autonomous sequences, mechanisms that need to coordinate timing — manually managing all those state transitions becomes fragile.<br><br>Command-Based architecture solves this with a <strong>scheduler</strong> that handles orchestration. Instead of writing state machines yourself, you define small, reusable <strong>commands</strong> and let the scheduler run them.<br><br><strong>The key mental shift:</strong> In your current architecture, the OpMode decides what happens and when. In command-based, you declare <em>what should happen</em> and the scheduler figures out the <em>when</em>.'
      },
      {
        title: 'Commands: The Building Blocks',
        content: 'A command is a small, self-contained action with four lifecycle methods: <code>initialize()</code> runs once when starting, <code>execute()</code> runs every loop, <code>isFinished()</code> returns true when done, and <code>end(interrupted)</code> handles cleanup.',
        code: `public class DriveToDistance extends CommandBase {
    private final Drivetrain drivetrain;
    private final double targetCM;

    public DriveToDistance(Drivetrain drivetrain, double targetCM) {
        this.drivetrain = drivetrain;
        this.targetCM = targetCM;
        addRequirements(drivetrain);
    }

    @Override
    public void initialize() { drivetrain.resetEncoders(); }

    @Override
    public void execute() {
        double error = targetCM - drivetrain.getDistanceCM();
        drivetrain.drive(error * 0.02, 0);
    }

    @Override
    public boolean isFinished() {
        return Math.abs(targetCM - drivetrain.getDistanceCM()) < 1.0;
    }

    @Override
    public void end(boolean interrupted) { drivetrain.stop(); }
}`
      },
      {
        title: 'Command Composition: The Real Power',
        content: 'The real power is composing commands — chaining them sequentially or running them in parallel:',
        code: `// Sequential: drive, then intake, then drive back
Command autoSequence = new SequentialCommandGroup(
    new DriveToDistance(drivetrain, 100),
    new RunIntake(intake, 0.8).withTimeout(2.0),
    new DriveToDistance(drivetrain, -100)
);

// Parallel: spin up shooter WHILE driving
Command scorePrep = new ParallelCommandGroup(
    new DriveToDistance(drivetrain, 50),
    new SpinUpShooter(shooter, 290)
);`
      },
      {
        title: 'When to Use Command-Based vs Phase 2 Architecture',
        content: '<strong>Stick with Phase 2 architecture when:</strong> 3 or fewer subsystems, fewer than 10 auto steps, team is still learning, you want explicit control over timing.<br><br><strong>Consider command-based when:</strong> 5+ subsystems needing coordination, complex parallel autonomous actions, multiple programmers working on different sequences, frequent state transition bugs.<br><br>Command-based isn\'t "better" — it\'s more abstract. That abstraction helps at scale but adds complexity for simple robots. Most FTC teams do fine without it.'
      },
      {
        title: 'FTC Libraries',
        content: '<strong>FTCLib</strong> is the most popular FTC command-based library, modeled after WPILib (FRC\'s framework). If you adopt command-based, start by refactoring one subsystem at a time. Don\'t rewrite everything at once.'
      }
    ],
    deliverable: {
      title: 'Command-Based Refactor',
      description: 'Take your Phase 4 autonomous and refactor it using FTCLib\'s command-based framework.',
      requirements: [
        'Convert drivetrain subsystem to extend SubsystemBase',
        'Write a FollowPath command wrapping Pedro Pathing followPath() + isBusy()',
        'Write a RunIntake command that runs for a specified duration',
        'Compose a SequentialCommandGroup replicating your original autonomous',
        'Compare both versions: which is easier to read and modify?'
      ]
    }
  };

  /* ══════════════════════════════════════════════════════════════════════════
     ADVANCED MODULE 2 — Competition Strategy Engineering
     ══════════════════════════════════════════════════════════════════════ */
  var ADVANCED_2_CONTENT = {
    type: 'advanced',
    title: 'Competition Strategy Engineering',
    estimatedTime: '15 minutes',
    sections: [
      {
        title: 'Strategy-Driven Auto Design',
        content: '<strong>The wrong way:</strong> What\'s the maximum score? Build that. It works 60% of the time. It fails at competition.<br><br><strong>The right way:</strong> Work backwards from match strategy. What does our alliance need? What\'s the minimum reliable contribution? How do we maximize reliability? Only then: can we add more scoring?<br><br>A 5-point auto that works 100% of the time is worth more than a 15-point auto that works 40% of the time. Reliability compounds over a tournament.'
      },
      {
        title: 'Expected Value Calculation',
        content: 'Before committing to an autonomous strategy, calculate expected value:',
        code: `// Expected Points = (Success Rate) × (Points if Success) + (Failure Rate) × (Points if Failure)

// Simple Auto: 95% × 5 + 5% × 0 = 4.75 expected points
// Complex Auto: 60% × 15 + 40% × 2 = 9.8 expected points
// Risky Auto:  30% × 25 + 70% × (-5) = 4.0 expected points

// The Risky Auto has the HIGHEST max score
// but the LOWEST expected value!`
      },
      {
        title: 'Building a Tiered Auto System',
        content: 'Competition-ready teams have a <strong>tiered system</strong>, not one autonomous:<br><br><strong>Tier 1 — "Always Works"</strong> (elimination rounds): Simplest path, minimum viable points, no sensor dependencies. This is your safety net.<br><br><strong>Tier 2 — "Usually Works"</strong> (most qualification matches): Moderate complexity, competitive scoring, has fallback behavior.<br><br><strong>Tier 3 — "High Ceiling"</strong> (when you need a big score): Maximum scoring potential, complex paths. Used strategically.<br><br>Drivers select the tier on the Driver Station during init — it\'s a strategic decision, not a coding one.'
      },
      {
        title: 'Fail-Safe Design Patterns',
        content: 'Three essential patterns:',
        code: `// Pattern 1: Timer-Based Fallback
// If a path takes too long, skip it and park
if (autoTimer.getElapsedTimeSeconds() > 5.0) {
    follower.breakFollowing();
    pathState = PARK;
}

// Pattern 2: Sensor Validation
double distance = distanceSensor.getDistance(DistanceUnit.CM);
if (Double.isNaN(distance) || distance > 300) {
    useTimerFallback = true;
}

// Pattern 3: Autonomous End Protection
if (autoTimer.getElapsedTimeSeconds() > 27.0) {
    // <3 seconds left — emergency park!
    pathState = EMERGENCY_PARK;
}`
      },
      {
        title: 'Post-Match Review',
        content: 'After every match, answer five questions: Did the auto complete fully? Was the failure code, mechanical, or strategic? What was actual vs expected point contribution? Did anything unexpected happen? What one fix has the highest impact?<br><br>Keep a match log tracking auto tier used, expected points, actual points, failure mode, and fix applied. After 5+ matches, patterns emerge — use data, not feelings, to make strategic decisions.'
      },
      {
        title: 'The Engineering Mindset',
        content: 'Competition programming is not about writing impressive code. It\'s about <strong>delivering reliable performance under pressure</strong>. The best teams ship early and iterate, test under match conditions, make data-driven decisions, prioritize ruthlessly, and stay calm in the pit. This isn\'t coding skill — it\'s engineering discipline.'
      }
    ],
    deliverable: {
      title: 'Strategy Analysis',
      description: 'Analyze your team\'s current autonomous strategy using the frameworks from this module.',
      requirements: [
        'Calculate expected value for your current autonomous (success rate \u00d7 points)',
        'Design a 3-tier autonomous system with clear tier selection criteria',
        'Add timer-based fallbacks and end-of-auto protection to your existing code',
        'Create a match log template your team can use at competition',
        'Write a 1-page strategy document for your next competition'
      ]
    }
  };

  /* ══════════════════════════════════════════════════════════════════════════
     CAPSTONE PROJECT — Full Competition Autonomous
     ══════════════════════════════════════════════════════════════════════ */
  var CAPSTONE_CONTENT = {
    type: 'capstone',
    title: 'Full Competition Autonomous',
    estimatedTime: '8-14 sessions',
    intro: 'This is the culmination of everything you\'ve learned. Build a complete, competition-grade autonomous routine from scratch — one that could run in an actual FTC match. There are no step-by-step instructions. You will make architecture decisions, debug problems, tune constants, and make strategic trade-offs.',
    scenario: 'You are given access to a robot with: mecanum drivetrain (4 DC motors), dead wheel odometry, one intake mechanism, one scoring mechanism, one color sensor, and one distance sensor. Build an autonomous that scores as many points as possible in 30 seconds.',
    requirements: [
      { category: 'Architecture (Phase 2)', items: [
        'All hardware wrapped in proper subsystem classes with private fields and public methods',
        'A Robot class that initializes all subsystems',
        'Enum-based state machines in every subsystem that needs them',
        'Zero direct hardware calls in the OpMode'
      ]},
      { category: 'Sensors (Phase 3)', items: [
        'At least one sensor-driven decision (color sorting, distance stopping, etc.)',
        'Sensor filtering — no single-reading decisions',
        'Fallback behavior if sensor returns garbage data'
      ]},
      { category: 'Path Following (Phase 4)', items: [
        'Pedro Pathing for all driving with at least 4 distinct waypoints',
        'Heading interpolation on every path segment',
        'follower.update() called exactly once per loop',
        'Poses defined as class fields, paths built in buildPaths() from start()'
      ]},
      { category: 'Robustness (Phase 5)', items: [
        'Telemetry displaying: current state, sensor values, motor powers, loop time',
        'Timer-based fallback if any path takes too long',
        'Emergency park if less than 3 seconds remain',
        'Survives 5 consecutive runs without crashing'
      ]},
      { category: 'Strategy (Advanced)', items: [
        'Alliance mirroring — works on both sides from one codebase',
        'Alliance selection via gamepad during init_loop()',
        'Documented expected value calculation'
      ]}
    ],
    deliverables: [
      'The complete code — all subsystem files, Robot class, and autonomous OpMode',
      'Strategy document (1 page) — scoring strategy, expected value, fallback plan, risks',
      'Tuning log — odometry calibration, PID constants, accuracy observations, bugs fixed',
      'Live demo — 5 consecutive runs, at least 4 scoring within 80% of predicted value',
      'Code review defense — explain any part of your code when asked'
    ],
    rubric: [
      { category: 'Architecture', weight: 25, description: 'Clean subsystem boundaries, proper encapsulation, Robot class pattern' },
      { category: 'Path Following & Precision', weight: 25, description: 'Smooth paths, consistent execution, correct API usage' },
      { category: 'Robustness', weight: 20, description: 'Sensor filtering, fallbacks, telemetry, no crashes' },
      { category: 'Strategy & Decisions', weight: 15, description: 'Sensor decisions work, mirroring works, clear reasoning' },
      { category: 'Code Quality & Understanding', weight: 15, description: 'Readable, well-commented, student can explain everything' }
    ]
  };

  /* ══════════════════════════════════════════════════════════════════════════
     PHASE LESSONS REGISTRY
     ══════════════════════════════════════════════════════════════════════ */
  window.PHASE_LESSONS = {
    phase1: PHASE_1_LESSONS,
    phase2: PHASE_2_LESSONS,
    phase3: PHASE_3_THEORY.concat(PHASE_3_LESSONS),
    phase4: PHASE_4_THEORY.concat(PHASE_4_LESSONS),
    phase5: PHASE_5_THEORY.concat(PHASE_5_LESSONS)
  };

  window.ADVANCED_CONTENT = {
    advanced_command: ADVANCED_1_CONTENT,
    advanced_strategy: ADVANCED_2_CONTENT,
    capstone: CAPSTONE_CONTENT
  };

  /* ══════════════════════════════════════════════════════════════════════════
     SYNTAX HIGHLIGHTER — inline styles, no CSS classes
     ══════════════════════════════════════════════════════════════════════ */
  function highlightJava(code) {
    // 1. HTML-escape raw code so < > & are safe
    var escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Single-pass: extract comments, strings, and annotations into placeholders
    var tokens = [];
    var tokenized = escaped.replace(/(\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|(@\w+)/g, function(match) {
      var idx = tokens.length;
      tokens.push(match);
      return '\x00TOK' + idx + '\x00';
    });

    // 4. Keywords
    var keywords = ['public', 'private', 'protected', 'class', 'void', 'int', 'double', 'boolean', 'float', 'String', 'if', 'else', 'while', 'for', 'return', 'new', 'import', 'extends', 'implements', 'static', 'final', 'this', 'true', 'false', 'null', 'enum', 'switch', 'case', 'break', 'try', 'catch', 'throws', 'throw', 'override', 'Override'];
    keywords.forEach(function(kw) {
      var regex = new RegExp('\\b(' + kw + ')\\b', 'g');
      tokenized = tokenized.replace(regex, '<span style="color:#c678dd">$1</span>');
    });

    // 5. FTC-specific types
    var types = ['DcMotor', 'Servo', 'HardwareMap', 'LinearOpMode', 'OpMode', 'Gamepad', 'Telemetry', 'ElapsedTime', 'Range', 'Pose', 'BezierLine', 'BezierCurve', 'PathChain', 'Follower', 'ColorSensor', 'ColorRangeSensor', 'DistanceSensor', 'TouchSensor', 'TeleOp', 'Autonomous', 'DistanceUnit', 'Direction', 'Math'];
    types.forEach(function(t) {
      var regex = new RegExp('\\b(' + t + ')\\b', 'g');
      tokenized = tokenized.replace(regex, '<span style="color:#e5c07b">$1</span>');
    });

    // 6. Numbers
    tokenized = tokenized.replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#d19a66">$1</span>');

    // 7. Restore tokens with their colors
    var html = tokenized.replace(/\x00TOK(\d+)\x00/g, function(m, idx) {
      var tok = tokens[parseInt(idx)];
      if (tok.charAt(0) === '/') {
        // Comment
        return '<span style="color:#6a737d">' + tok + '</span>';
      } else if (tok.charAt(0) === '@') {
        // Annotation
        return '<span style="color:#98c379">' + tok + '</span>';
      } else {
        // String
        return '<span style="color:#98c379">' + tok + '</span>';
      }
    });

    return html;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     LESSON RENDERER
     ══════════════════════════════════════════════════════════════════════ */

  // State: tracks which sections are completed and current progress
  var lessonState = {
    phaseId: null,
    completed: [],    // array of completed section IDs
    answeredChecks: {} // sectionId -> true (correctly answered)
  };

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * Render the full interactive lesson for a phase.
   * @param {string} phaseId - e.g. 'phase1'
   * @param {Array} sections - array of section objects
   * @param {string} containerId - DOM id to render into
   * @param {Array} completedSections - previously completed section IDs from Firestore
   */
  window.renderLessons = function (phaseId, sections, containerId, completedSections) {
    lessonState.phaseId = phaseId;
    lessonState.completed = completedSections ? completedSections.slice() : [];
    lessonState.answeredChecks = {};

    // Mark previously completed checks as answered
    lessonState.completed.forEach(function (id) { lessonState.answeredChecks[id] = true; });

    var el = document.getElementById(containerId);
    if (!el) return;

    var totalSections = sections.length;
    var doneCount = lessonState.completed.length;

    // Find first incomplete section
    var firstIncomplete = -1;
    for (var f = 0; f < sections.length; f++) {
      if (lessonState.completed.indexOf(sections[f].id) === -1) {
        firstIncomplete = f;
        break;
      }
    }
    if (firstIncomplete === -1) firstIncomplete = sections.length; // all done

    // Estimated time
    var estMinutes = Math.max(5, sections.length * 2);

    var html = '';

    // Progress bar
    html += '<div class="les-progress-wrap">';
    html += '<div class="les-progress-bar"><div class="les-progress-fill" id="les-progress-fill" style="width:' + Math.round((doneCount / totalSections) * 100) + '%"></div></div>';
    html += '<div class="les-progress-text"><span id="les-progress-label">Section ' + (Math.min(firstIncomplete + 1, totalSections)) + ' of ' + totalSections + '</span><span>About ' + estMinutes + ' min</span></div>';
    html += '</div>';

    // Sections
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      var isDone = lessonState.completed.indexOf(sec.id) !== -1;
      var isActive = (i === firstIncomplete);
      var isLocked = (i > firstIncomplete && !isDone);

      html += '<div class="les-section' + (isDone ? ' done' : '') + (isActive ? ' active' : '') + (isLocked ? ' locked' : '') + (sec.isTheory ? ' les-theory' : '') + '" id="les-sec-' + sec.id + '" data-idx="' + i + '">';

      // Section header
      html += '<div class="les-sec-header" onclick="window._toggleSection(\'' + sec.id + '\')">';
      if (isDone) {
        html += '<div class="les-sec-check">&#10003;</div>';
      } else if (isLocked) {
        html += '<div class="les-sec-lock">&#128274;</div>';
      } else {
        html += '<div class="les-sec-num' + (sec.isTheory ? ' les-sec-num-theory' : '') + '">' + (i + 1) + '</div>';
      }
      html += '<div class="les-sec-title">' + esc(sec.title) + '</div>';
      if (sec.isTheory && !isDone) html += '<span class="les-theory-badge">\ud83d\udcd0 THEORY</span>';
      if (isDone) html += '<div class="les-sec-expand">&#9660;</div>';
      html += '</div>';

      // Section body (hidden if locked or collapsed-done)
      html += '<div class="les-sec-body" id="les-body-' + sec.id + '" style="' + (isActive ? '' : 'display:none') + '">';

      // Learn block
      html += '<div class="les-learn">' + sec.learn + '</div>';

      // Code block — use innerHTML with highlighted HTML
      if (sec.code) {
        html += '<div class="les-code-wrap">';
        html += '<button class="les-copy-btn" onclick="window._copyCode(this)" data-sec="' + sec.id + '">Copy</button>';
        html += '<pre class="les-code">' + highlightJava(sec.code.snippet) + '</pre>';
        html += '</div>';
      }

      // Check block
      if (sec.check) {
        var isWritten = sec.check.type === 'written_answer';
        html += '<div class="les-check' + (sec.isTheory ? ' les-check-theory' : '') + '" id="les-check-' + sec.id + '">';
        if (isDone && !isWritten) {
          // Already answered MC — show collapsed success
          html += '<div class="les-check-done">&#10003; Correct</div>';
        } else if (isDone && isWritten) {
          // Completed written answer — show read-only textarea + feedback wrap for Firestore to populate
          html += '<div class="les-check-done" id="les-wdone-badge-' + sec.id + '">&#10003; Submitted</div>';
          html += '<div class="les-written-done-detail" id="les-wdone-' + sec.id + '" style="display:none">';
          html += '<div class="les-check-q">' + esc(sec.check.question) + '</div>';
          html += '<textarea class="les-written-area" id="les-written-' + sec.id + '" placeholder="Type your answer here..." readonly style="border-color:#22c55e;opacity:0.85"></textarea>';
          html += '<div class="les-written-footer">';
          html += '<span class="les-written-count" id="les-wcount-' + sec.id + '"></span>';
          html += '<button class="les-written-submit les-written-submitted" id="les-wsubmit-' + sec.id + '" style="display:none" onclick="window._submitWrittenAnswer(\'' + sec.id + '\')" disabled>Submit Answer</button>';
          html += '</div>';
          html += '<div class="les-written-attempts" id="les-wattempts-' + sec.id + '" style="display:none"></div>';
          html += '<div class="les-written-error" id="les-werror-' + sec.id + '" style="display:none"></div>';
          html += '<div class="theory-feedback-wrap" id="les-wfeedback-' + sec.id + '"></div>';
          html += '</div>';
        } else if (isWritten) {
          // Written answer check
          html += '<div class="les-check-icon">&#9999;&#65039;</div>';
          html += '<div class="les-check-q">' + esc(sec.check.question) + '</div>';
          html += '<textarea class="les-written-area" id="les-written-' + sec.id + '" placeholder="Type your answer here..." minlength="' + (sec.check.minLength || 50) + '"></textarea>';
          html += '<div class="les-written-footer">';
          html += '<span class="les-written-count" id="les-wcount-' + sec.id + '">0 / ' + (sec.check.minLength || 50) + ' characters minimum</span>';
          html += '<button class="les-written-submit" id="les-wsubmit-' + sec.id + '" onclick="window._submitWrittenAnswer(\'' + sec.id + '\')" disabled>Submit Answer</button>';
          html += '</div>';
          html += '<div class="les-written-attempts" id="les-wattempts-' + sec.id + '" style="display:none"></div>';
          html += '<div class="les-written-error" id="les-werror-' + sec.id + '" style="display:none"></div>';
          html += '<div class="theory-feedback-wrap" id="les-wfeedback-' + sec.id + '"></div>';
        } else {
          // Multiple choice check
          html += '<div class="les-check-icon">&#10067;</div>';
          html += '<div class="les-check-q">' + esc(sec.check.question) + '</div>';
          html += '<div class="les-check-opts" id="les-opts-' + sec.id + '">';
          for (var o = 0; o < sec.check.options.length; o++) {
            var opt = sec.check.options[o];
            html += '<div class="les-opt" id="les-opt-' + sec.id + '-' + o + '" onclick="window._answerCheck(\'' + sec.id + '\',' + o + ')">';
            html += '<div class="les-opt-letter">' + String.fromCharCode(65 + o) + '</div>';
            html += '<div class="les-opt-text">' + esc(opt.text) + '</div>';
            html += '</div>';
          }
          html += '</div>';
          html += '<div class="les-check-explain" id="les-explain-' + sec.id + '" style="display:none"></div>';
        }
        html += '</div>';
      } else {
        // No check — section completes automatically after reading
        if (!isDone) {
          html += '<div class="les-auto-complete">';
          html += '<button class="les-continue-btn" onclick="window._completeSection(\'' + sec.id + '\')">Continue &rarr;</button>';
          html += '</div>';
        }
      }

      // Mentor tip
      if (sec.mentorTip) {
        html += '<div class="les-tip">';
        html += '<div class="les-tip-toggle" onclick="window._toggleTip(this)">';
        html += '<span class="les-tip-icon">&#128161;</span> Mentor Tip <span class="les-tip-arrow">&#9654;</span>';
        html += '</div>';
        html += '<div class="les-tip-body" style="display:none">' + esc(sec.mentorTip) + '</div>';
        html += '</div>';
      }

      html += '</div>'; // les-sec-body
      html += '</div>'; // les-section
    }

    el.innerHTML = html;

    // Attach listeners and load Firestore data for ALL written-answer sections (active AND completed)
    for (var wi = 0; wi < sections.length; wi++) {
      if (sections[wi].check && sections[wi].check.type === 'written_answer') {
        var wiDone = lessonState.completed.indexOf(sections[wi].id) !== -1;
        (function (sid, minLen, sectionDone) {
          var ta = document.getElementById('les-written-' + sid);
          var countEl = document.getElementById('les-wcount-' + sid);
          var submitBtn = document.getElementById('les-wsubmit-' + sid);
          if (!ta) return;

          // Attach input listener for active (non-done) sections
          if (!sectionDone) {
            ta.addEventListener('input', function () {
              var len = ta.value.trim().length;
              if (countEl) countEl.textContent = len + ' / ' + minLen + ' characters minimum';
              if (submitBtn) submitBtn.disabled = (len < minLen);
            });
          }

          // Load previously submitted answer from Firestore (both done and active)
          if (window.rtUser && window.rtDb) {
            window.rtDb.collection('users').doc(window.rtUser.uid)
              .collection('curriculum').doc(phaseId).get()
              .then(function (doc) {
                if (!doc.exists) return;
                var data = doc.data();
                if (!data.theoryAnswers || !data.theoryAnswers[sid]) return;

                var saved = data.theoryAnswers[sid];
                ta.value = saved.answer || '';
                _theoryAttemptCounts[sid] = saved.attempts || 1;

                // Show attempt count
                var attemptsEl = document.getElementById('les-wattempts-' + sid);
                if (attemptsEl && saved.attempts) {
                  attemptsEl.textContent = 'Submitted ' + saved.attempts + ' time' + (saved.attempts > 1 ? 's' : '') + (saved.bestScore ? ' \u2022 Best: ' + saved.bestScore + '/100' : '');
                  attemptsEl.style.display = 'block';
                }

                if (saved.passed) {
                  ta.readOnly = true;
                  ta.style.borderColor = '#22c55e';
                  ta.style.opacity = '0.85';
                  if (countEl) countEl.textContent = '\u2713 Passed \u2014 ' + (saved.bestScore || saved.score || '') + '/100';
                  if (submitBtn) {
                    submitBtn.style.display = 'none';
                    submitBtn.disabled = true;
                    submitBtn.classList.add('les-written-submitted');
                  }
                  var fbWrap = document.getElementById('les-wfeedback-' + sid);
                  if (fbWrap) {
                    var passHtml = '<div class="theory-feedback passed"><div class="score-badge">\u2713 Understanding Confirmed \u2014 ' + (saved.bestScore || saved.score || 70) + '/100</div>';
                    if (saved.feedback) passHtml += '<div class="feedback-text">' + esc(saved.feedback) + '</div>';
                    passHtml += '</div>';
                    passHtml += '<div class="les-written-resubmit-link" onclick="window._reviseTheoryAnswer(\'' + sid + '\', true)">Resubmit answer</div>';
                    fbWrap.innerHTML = passHtml;
                  }
                  // For completed sections, also show the detail panel and hide the simple badge
                  if (sectionDone) {
                    var doneDetail = document.getElementById('les-wdone-' + sid);
                    var doneBadge = document.getElementById('les-wdone-badge-' + sid);
                    if (doneDetail) doneDetail.style.display = 'block';
                    if (doneBadge) doneBadge.style.display = 'none';
                  }
                } else if (saved.score !== undefined && !saved.passed) {
                  ta.readOnly = true;
                  ta.style.borderColor = '#eab308';
                  ta.style.opacity = '0.85';
                  if (countEl) countEl.textContent = 'Score: ' + saved.score + '/100 \u2014 Revision needed';
                  if (submitBtn) submitBtn.style.display = 'none';
                  var fbWrap2 = document.getElementById('les-wfeedback-' + sid);
                  if (fbWrap2) {
                    var fbHtml = '<div class="theory-feedback failed"><div class="score-badge">\u26a0 Keep Thinking \u2014 ' + saved.score + '/100</div>';
                    if (saved.feedback) fbHtml += '<div class="feedback-text">' + esc(saved.feedback) + '</div>';
                    fbHtml += '</div>';
                    fbHtml += '<button class="les-written-submit les-written-revise" onclick="window._reviseTheoryAnswer(\'' + sid + '\', false)">Revise &amp; Resubmit</button>';
                    fbWrap2.innerHTML = fbHtml;
                  }
                  if (sectionDone) {
                    var doneDetail2 = document.getElementById('les-wdone-' + sid);
                    var doneBadge2 = document.getElementById('les-wdone-badge-' + sid);
                    if (doneDetail2) doneDetail2.style.display = 'block';
                    if (doneBadge2) doneBadge2.style.display = 'none';
                  }
                } else {
                  // Legacy: submitted without AI grading
                  ta.readOnly = true;
                  ta.style.borderColor = '#22c55e';
                  ta.style.opacity = '0.85';
                  if (countEl) countEl.textContent = '\u2713 Previously submitted';
                  if (submitBtn) {
                    submitBtn.textContent = '\u2713 Submitted';
                    submitBtn.disabled = true;
                    submitBtn.classList.add('les-written-submitted');
                  }
                }
              }).catch(function () {});
          }
        })(sections[wi].id, sections[wi].check.minLength || 50, wiDone);
      }
    }
  };

  /* ── Section toggling ─────────────────────────────────────────────────── */
  window._toggleSection = function (secId) {
    var sec = document.getElementById('les-sec-' + secId);
    if (!sec) return;
    // Only allow toggling completed sections (re-read) or active
    if (sec.classList.contains('locked')) return;
    var body = document.getElementById('les-body-' + secId);
    if (!body) return;
    var isVisible = body.style.display !== 'none';
    body.style.display = isVisible ? 'none' : 'block';
    // Update arrow
    var arrow = sec.querySelector('.les-sec-expand');
    if (arrow) arrow.innerHTML = isVisible ? '&#9654;' : '&#9660;';
  };

  /* ── Copy code — copies RAW snippet, not highlighted HTML ─────────────── */
  window._copyCode = function (btn) {
    var secId = btn.getAttribute('data-sec');
    // Find the raw snippet from the lesson data
    var phaseId = lessonState.phaseId;
    var sections = window.PHASE_LESSONS[phaseId];
    var rawCode = '';
    if (sections && secId) {
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].id === secId && sections[i].code) {
          rawCode = sections[i].code.snippet;
          break;
        }
      }
    }
    if (!rawCode) {
      // Fallback: get textContent from the pre element
      var pre = btn.parentElement.querySelector('pre');
      if (pre) rawCode = pre.textContent;
    }
    if (!rawCode) return;
    navigator.clipboard.writeText(rawCode).then(function () {
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
    });
  };

  /* ── Mentor tip toggle ────────────────────────────────────────────────── */
  window._toggleTip = function (header) {
    var body = header.nextElementSibling;
    if (!body) return;
    var isVisible = body.style.display !== 'none';
    body.style.display = isVisible ? 'none' : 'block';
    var arrow = header.querySelector('.les-tip-arrow');
    if (arrow) arrow.innerHTML = isVisible ? '&#9654;' : '&#9660;';
  };

  /* ── Answer a check question ──────────────────────────────────────────── */
  window._answerCheck = function (secId, optIdx) {
    if (lessonState.answeredChecks[secId]) return;

    var phaseId = lessonState.phaseId;
    var sections = window.PHASE_LESSONS[phaseId];
    if (!sections) return;

    var sec = null;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].id === secId) { sec = sections[i]; break; }
    }
    if (!sec || !sec.check) return;

    var opt = sec.check.options[optIdx];
    var optEl = document.getElementById('les-opt-' + secId + '-' + optIdx);
    var explainEl = document.getElementById('les-explain-' + secId);

    if (opt.correct) {
      // Correct answer
      optEl.classList.add('les-correct');
      if (explainEl) {
        explainEl.innerHTML = '<div class="les-explain-icon correct">&#10003;</div> ' + esc(opt.explanation);
        explainEl.className = 'les-check-explain correct';
        explainEl.style.display = 'block';
      }
      lessonState.answeredChecks[secId] = true;

      // Disable all options
      var allOpts = document.querySelectorAll('#les-opts-' + secId + ' .les-opt');
      for (var d = 0; d < allOpts.length; d++) {
        allOpts[d].style.pointerEvents = 'none';
        if (d !== optIdx) allOpts[d].style.opacity = '0.4';
      }

      // After a brief delay, complete the section
      setTimeout(function () {
        _doCompleteSection(secId);
      }, 800);
    } else {
      // Wrong answer
      optEl.classList.add('les-wrong');
      if (explainEl) {
        explainEl.innerHTML = '<div class="les-explain-icon wrong">&#10007;</div> ' + esc(opt.explanation);
        explainEl.className = 'les-check-explain wrong';
        explainEl.style.display = 'block';
      }
      // Disable just this option
      optEl.style.pointerEvents = 'none';
    }
  };

  /* ── Written answer submission ────────────────────────────────────────── */
  // Rate-limit tracker for theory submissions
  var _theorySubmitCooldown = {};
  // Track attempt counts per section (loaded from Firestore)
  var _theoryAttemptCounts = {};

  window._submitWrittenAnswer = function (secId) {
    // Rate limit: 10s cooldown
    if (_theorySubmitCooldown[secId]) return;

    var phaseId = lessonState.phaseId;
    var sections = window.PHASE_LESSONS[phaseId];
    if (!sections) return;

    var sec = null;
    for (var si = 0; si < sections.length; si++) {
      if (sections[si].id === secId) { sec = sections[si]; break; }
    }
    if (!sec || !sec.check || sec.check.type !== 'written_answer') return;

    var textarea = document.getElementById('les-written-' + secId);
    var errorEl = document.getElementById('les-werror-' + secId);
    var submitBtn = document.getElementById('les-wsubmit-' + secId);
    if (!textarea) return;

    var answer = textarea.value.trim();
    var minLen = sec.check.minLength || 50;

    if (answer.length < minLen) {
      if (errorEl) {
        errorEl.textContent = 'Please write at least 2-3 sentences explaining your understanding.';
        errorEl.style.display = 'block';
      }
      return;
    }

    // Hide error
    if (errorEl) errorEl.style.display = 'none';

    // Disable textarea and button during review
    textarea.readOnly = true;
    textarea.style.opacity = '0.7';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'AI Mentor is reading your answer...';
      submitBtn.classList.add('les-written-loading');
    }

    // Start cooldown
    _theorySubmitCooldown[secId] = true;

    // Strip HTML tags from learn content for the prompt
    var plainLearn = (sec.learn || '').replace(/<[^>]+>/g, '');
    var phaseNum = phaseId.replace('phase', '');

    // Call AI review
    var doReview = function (retryCount) {
      window.reviewTheoryAnswer(phaseNum, secId, sec.title, plainLearn, sec.check.question, answer)
        .then(function (result) {
          _renderTheoryFeedback(secId, result, answer, phaseId, textarea, submitBtn);
        })
        .catch(function (err) {
          console.error('[Theory] AI review error:', err);
          if (retryCount < 1 && err && String(err).indexOf('429') !== -1) {
            if (submitBtn) submitBtn.textContent = 'AI mentor is busy. Retrying in 15s...';
            setTimeout(function () { doReview(retryCount + 1); }, 15000);
          } else {
            _renderTheoryFeedback(secId, null, answer, phaseId, textarea, submitBtn);
          }
        });
    };
    doReview(0);

    // Release cooldown after 10s
    setTimeout(function () { delete _theorySubmitCooldown[secId]; }, 10000);
  };

  function _renderTheoryFeedback(secId, result, answer, phaseId, textarea, submitBtn) {
    var feedbackWrap = document.getElementById('les-wfeedback-' + secId);
    if (!feedbackWrap) return;

    // If AI returned null (error), auto-pass with a note
    if (!result) {
      result = { passed: true, score: 70, feedback: 'AI review unavailable. Your answer has been accepted.', strengths: [], misconceptions: [], suggestion: '' };
    }

    var passed = result.passed && result.score >= 70;
    var attemptNum = (_theoryAttemptCounts[secId] || 0) + 1;
    _theoryAttemptCounts[secId] = attemptNum;

    // Build feedback card HTML
    var html = '<div class="theory-feedback ' + (passed ? 'passed' : 'failed') + '">';
    html += '<div class="score-badge">' + (passed ? '\u2713 Understanding Confirmed' : '\u26a0 Keep Thinking') + ' &mdash; ' + result.score + '/100</div>';
    if (result.feedback) {
      html += '<div class="feedback-text">' + esc(result.feedback) + '</div>';
    }
    if (result.strengths && result.strengths.length > 0) {
      html += '<ul class="strengths">';
      for (var s = 0; s < result.strengths.length; s++) {
        html += '<li>\u2713 ' + esc(result.strengths[s]) + '</li>';
      }
      html += '</ul>';
    }
    if (!passed && result.misconceptions && result.misconceptions.length > 0) {
      html += '<ul class="misconceptions">';
      for (var m = 0; m < result.misconceptions.length; m++) {
        html += '<li>\u26a0 ' + esc(result.misconceptions[m]) + '</li>';
      }
      html += '</ul>';
    }
    if (result.suggestion) {
      html += '<div class="suggestion">\ud83d\udca1 ' + esc(result.suggestion) + '</div>';
    }
    html += '</div>';

    // Resubmit controls
    if (!passed) {
      html += '<button class="les-written-submit les-written-revise" onclick="window._reviseTheoryAnswer(\'' + secId + '\', false)">Revise &amp; Resubmit</button>';
    } else {
      html += '<div class="les-written-resubmit-link" onclick="window._reviseTheoryAnswer(\'' + secId + '\', true)">Resubmit answer</div>';
    }

    feedbackWrap.innerHTML = html;

    // Update attempt count display
    var attemptsEl = document.getElementById('les-wattempts-' + secId);
    if (attemptsEl) {
      attemptsEl.textContent = 'Submitted ' + attemptNum + ' time' + (attemptNum > 1 ? 's' : '');
      attemptsEl.style.display = 'block';
    }

    // Save to Firestore with history
    _saveTheoryToFirestore(secId, answer, result, passed, attemptNum, phaseId);

    if (passed) {
      lessonState.answeredChecks[secId] = true;
      textarea.style.borderColor = '#22c55e';
      textarea.style.opacity = '0.85';
      if (submitBtn) {
        submitBtn.textContent = '\u2713 Passed';
        submitBtn.classList.remove('les-written-loading');
        submitBtn.classList.add('les-written-submitted');
        submitBtn.style.display = 'none';
      }
      // Complete section if not already completed
      if (lessonState.completed.indexOf(secId) === -1) {
        setTimeout(function () { _doCompleteSection(secId); }, 1200);
      }
    } else {
      textarea.readOnly = true;
      textarea.style.borderColor = '#eab308';
      textarea.style.opacity = '0.85';
      if (submitBtn) {
        submitBtn.style.display = 'none';
        submitBtn.classList.remove('les-written-loading');
      }
    }
  }

  function _saveTheoryToFirestore(secId, answer, result, passed, attemptNum, phaseId) {
    if (!window.rtUser || !window.rtDb) return;
    var uid = window.rtUser.uid;
    var docRef = window.rtDb.collection('users').doc(uid).collection('curriculum').doc(phaseId);

    docRef.get().then(function (doc) {
      var existing = {};
      if (doc.exists && doc.data().theoryAnswers && doc.data().theoryAnswers[secId]) {
        existing = doc.data().theoryAnswers[secId];
      }

      var history = existing.history || [];
      history.push({
        answer: answer,
        score: result.score,
        timestamp: new Date().toISOString()
      });

      var bestScore = Math.max(result.score, existing.bestScore || 0);

      var answerData = {};
      answerData[secId] = {
        answer: answer,
        score: result.score,
        passed: passed || existing.passed || false,
        bestScore: bestScore,
        feedback: result.feedback || '',
        attempts: attemptNum,
        lastAttempt: new Date().toISOString(),
        history: history
      };

      docRef.set({ theoryAnswers: answerData }, { merge: true });
    }).catch(function (e) {
      // Fallback: save without history merge
      var answerData = {};
      answerData[secId] = {
        answer: answer,
        score: result.score,
        passed: passed,
        bestScore: result.score,
        feedback: result.feedback || '',
        attempts: attemptNum,
        lastAttempt: new Date().toISOString()
      };
      docRef.set({ theoryAnswers: answerData }, { merge: true });
      console.warn('[Lessons] Saved theory answer (no history merge):', e.message);
    });
  }

  window._reviseTheoryAnswer = function (secId, isPassed) {
    if (isPassed) {
      if (!confirm('You\'ve already passed this section. Resubmitting will update your answer and score. Your completion status won\'t be lost.')) {
        return;
      }
    }

    var textarea = document.getElementById('les-written-' + secId);
    var submitBtn = document.getElementById('les-wsubmit-' + secId);
    var feedbackWrap = document.getElementById('les-wfeedback-' + secId);
    var countEl = document.getElementById('les-wcount-' + secId);

    // Find minLength for this section
    var sections = window.PHASE_LESSONS[lessonState.phaseId];
    var minLen = 50;
    if (sections) {
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].id === secId && sections[i].check) { minLen = sections[i].check.minLength || 50; break; }
      }
    }

    if (textarea) {
      textarea.readOnly = false;
      textarea.style.borderColor = '#333';
      textarea.style.opacity = '1';
      textarea.focus();

      // Attach input listener (use a flag to avoid duplicates)
      if (!textarea._hasReviseListener) {
        textarea._hasReviseListener = true;
        textarea.addEventListener('input', function () {
          var len = textarea.value.trim().length;
          if (countEl) countEl.textContent = len + ' / ' + minLen + ' characters minimum';
          if (submitBtn) submitBtn.disabled = (len < minLen);
        });
      }
    }

    var len = textarea ? textarea.value.trim().length : 0;
    if (submitBtn) {
      submitBtn.style.display = '';
      submitBtn.disabled = (len < minLen);
      submitBtn.textContent = 'Resubmit Answer';
      submitBtn.classList.remove('les-written-submitted', 'les-written-loading');
    }
    if (countEl) {
      countEl.textContent = len + ' / ' + minLen + ' characters minimum';
    }
    // Keep feedback visible but dim it
    if (feedbackWrap) {
      var fb = feedbackWrap.querySelector('.theory-feedback');
      if (fb) fb.style.opacity = '0.4';
      var revBtn = feedbackWrap.querySelector('.les-written-revise');
      if (revBtn) revBtn.style.display = 'none';
      var resubLink = feedbackWrap.querySelector('.les-written-resubmit-link');
      if (resubLink) resubLink.style.display = 'none';
    }
  };

  /* ── Complete section (no-check sections) ─────────────────────────────── */
  window._completeSection = function (secId) {
    _doCompleteSection(secId);
  };

  function _doCompleteSection(secId) {
    if (lessonState.completed.indexOf(secId) !== -1) return;
    lessonState.completed.push(secId);

    var phaseId = lessonState.phaseId;
    var sections = window.PHASE_LESSONS[phaseId];
    if (!sections) return;

    var secIdx = -1;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].id === secId) { secIdx = i; break; }
    }
    if (secIdx === -1) return;

    // Update the completed section's visual state
    var secEl = document.getElementById('les-sec-' + secId);
    if (secEl) {
      secEl.classList.add('done');
      secEl.classList.remove('active');
      // Add checkmark to header
      var numEl = secEl.querySelector('.les-sec-num');
      if (numEl) {
        numEl.className = 'les-sec-check';
        numEl.innerHTML = '&#10003;';
      }
      // Add expand arrow
      var header = secEl.querySelector('.les-sec-header');
      if (header && !header.querySelector('.les-sec-expand')) {
        var arrow = document.createElement('div');
        arrow.className = 'les-sec-expand';
        arrow.innerHTML = '&#9660;';
        header.appendChild(arrow);
      }
      // Collapse the check to a green badge
      var checkEl = document.getElementById('les-check-' + secId);
      if (checkEl) {
        // Determine if this was a written answer section
        var isTheorySec = false;
        for (var si = 0; si < sections.length; si++) {
          if (sections[si].id === secId && sections[si].check && sections[si].check.type === 'written_answer') {
            isTheorySec = true; break;
          }
        }
        checkEl.innerHTML = '<div class="les-check-done">&#10003; ' + (isTheorySec ? 'Submitted' : 'Correct') + '</div>';
      }
    }

    // Collapse current section body after animation
    setTimeout(function () {
      var body = document.getElementById('les-body-' + secId);
      if (body) body.style.display = 'none';
      var arrowEl = secEl ? secEl.querySelector('.les-sec-expand') : null;
      if (arrowEl) arrowEl.innerHTML = '&#9654;';
    }, 400);

    // Unlock and expand next section
    var nextIdx = secIdx + 1;
    if (nextIdx < sections.length) {
      var nextSec = sections[nextIdx];
      var nextEl = document.getElementById('les-sec-' + nextSec.id);
      if (nextEl) {
        nextEl.classList.remove('locked');
        nextEl.classList.add('active');
        // Update the lock icon to a number
        var lockEl = nextEl.querySelector('.les-sec-lock');
        if (lockEl) {
          lockEl.className = 'les-sec-num';
          lockEl.textContent = (nextIdx + 1);
        }
        // Expand body with animation
        var nextBody = document.getElementById('les-body-' + nextSec.id);
        if (nextBody) {
          nextBody.style.display = 'block';
          nextBody.classList.add('les-slide-in');
          setTimeout(function () { nextBody.classList.remove('les-slide-in'); }, 500);
          // Scroll into view
          setTimeout(function () {
            nextEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
      }
    }

    // Update progress bar
    var total = sections.length;
    var done = lessonState.completed.length;
    var fillEl = document.getElementById('les-progress-fill');
    if (fillEl) fillEl.style.width = Math.round((done / total) * 100) + '%';
    var labelEl = document.getElementById('les-progress-label');
    if (labelEl) {
      if (done >= total) {
        labelEl.textContent = 'All ' + total + ' sections completed!';
      } else {
        labelEl.textContent = 'Section ' + (done + 1) + ' of ' + total;
      }
    }

    // Save progress to Firestore
    _saveLessonProgress(phaseId, lessonState.completed);
  }

  /* ── Firestore persistence ────────────────────────────────────────────── */
  function _saveLessonProgress(phaseId, completedIds) {
    if (!window.rtUser) return;
    var uid = window.rtUser.uid;
    try {
      window.rtDb.collection('users').doc(uid)
        .collection('curriculum').doc(phaseId)
        .set({ lessonProgress: completedIds }, { merge: true });
    } catch (e) {
      console.warn('[Lessons] Failed to save progress:', e.message);
    }
  }

  /**
   * Load lesson progress from Firestore data.
   * @param {string} phaseId
   * @param {Object} phaseData - the currData[phaseId] object
   * @returns {Array} completed section IDs
   */
  window.getLessonProgress = function (phaseId, phaseData) {
    if (!phaseData) return [];
    return phaseData.lessonProgress || [];
  };

  /* ══════════════════════════════════════════════════════════════════════════
     ADVANCED / CAPSTONE RENDERER
     ══════════════════════════════════════════════════════════════════════ */

  /**
   * Render advanced module or capstone content as a clean scrollable document.
   * @param {string} phaseId - e.g. 'advanced_command', 'capstone'
   * @param {string} containerId - DOM id to render into
   */
  window.renderAdvancedContent = function (phaseId, containerId) {
    var content = window.ADVANCED_CONTENT[phaseId];
    if (!content) return;

    var el = document.getElementById(containerId);
    if (!el) return;

    var html = '';
    var isCapstone = content.type === 'capstone';

    // Banner
    if (isCapstone) {
      html += '<div class="adv-banner adv-banner-capstone">';
      html += '<span class="adv-banner-icon">\ud83c\udfc6</span> Capstone Project — The final challenge';
      html += '</div>';
    } else {
      html += '<div class="adv-banner adv-banner-advanced">';
      html += '<span class="adv-banner-icon">\ud83c\udf93</span> Advanced Module — Prerequisite: Complete all 5 phases';
      html += '</div>';
    }

    // Estimated time
    html += '<div class="adv-time">Estimated time: ' + esc(content.estimatedTime) + '</div>';

    // Capstone intro + scenario
    if (isCapstone && content.intro) {
      html += '<p class="adv-intro">' + content.intro + '</p>';
    }
    if (isCapstone && content.scenario) {
      html += '<blockquote class="adv-quote">' + content.scenario + '</blockquote>';
    }

    // Sections (advanced modules)
    if (content.sections) {
      for (var i = 0; i < content.sections.length; i++) {
        var sec = content.sections[i];
        html += '<h2 class="adv-h2">' + esc(sec.title) + '</h2>';
        html += '<div class="adv-text">' + sec.content + '</div>';
        if (sec.code) {
          html += '<div class="les-code-wrap">';
          html += '<button class="les-copy-btn" onclick="window._copyAdvCode(this)">Copy</button>';
          html += '<pre class="les-code">' + highlightJava(sec.code) + '</pre>';
          html += '</div>';
        }
      }
    }

    // Capstone requirements (categorized checklists)
    if (isCapstone && content.requirements) {
      html += '<h2 class="adv-h2">Requirements</h2>';
      for (var r = 0; r < content.requirements.length; r++) {
        var req = content.requirements[r];
        html += '<h3 class="adv-h3">' + esc(req.category) + '</h3>';
        html += '<ul class="adv-checklist">';
        for (var ri = 0; ri < req.items.length; ri++) {
          html += '<li class="adv-check-item"><span class="adv-checkbox"></span>' + esc(req.items[ri]) + '</li>';
        }
        html += '</ul>';
      }
    }

    // Capstone deliverables list
    if (isCapstone && content.deliverables) {
      html += '<h2 class="adv-h2">What You\'ll Deliver</h2>';
      html += '<ol class="adv-deliverables">';
      for (var d = 0; d < content.deliverables.length; d++) {
        html += '<li>' + esc(content.deliverables[d]) + '</li>';
      }
      html += '</ol>';
    }

    // Capstone rubric table
    if (isCapstone && content.rubric) {
      html += '<h2 class="adv-h2">Grading Rubric</h2>';
      html += '<table class="adv-table">';
      html += '<thead><tr><th>Category</th><th>Weight</th><th>Description</th></tr></thead>';
      html += '<tbody>';
      for (var t = 0; t < content.rubric.length; t++) {
        var row = content.rubric[t];
        html += '<tr><td><strong>' + esc(row.category) + '</strong></td><td>' + row.weight + '%</td><td>' + esc(row.description) + '</td></tr>';
      }
      html += '</tbody></table>';
    }

    // Advanced module deliverable (not capstone — capstone uses DELIVERABLES in curriculum.html)
    if (!isCapstone && content.deliverable) {
      var del = content.deliverable;
      html += '<div class="adv-deliverable-section">';
      html += '<h2 class="adv-h2">Deliverable: ' + esc(del.title) + '</h2>';
      html += '<p class="adv-text">' + esc(del.description) + '</p>';
      html += '<ul class="adv-checklist">';
      for (var di = 0; di < del.requirements.length; di++) {
        html += '<li class="adv-check-item"><span class="adv-checkbox"></span>' + esc(del.requirements[di]) + '</li>';
      }
      html += '</ul>';
      html += '</div>';
    }

    el.innerHTML = html;
  };

  /* ── Copy code for advanced content (reads from pre textContent) ────── */
  window._copyAdvCode = function (btn) {
    var pre = btn.parentElement.querySelector('pre');
    if (!pre) return;
    navigator.clipboard.writeText(pre.textContent).then(function () {
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
    });
  };

})();
