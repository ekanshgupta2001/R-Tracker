package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.ColorSensor;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.DistanceSensor;
import com.qualcomm.robotcore.hardware.HardwareMap;
import com.qualcomm.robotcore.hardware.Servo;
import com.qualcomm.robotcore.util.ElapsedTime;
import com.pedropathing.follower.Follower;
import com.pedropathing.localization.Pose;
import com.pedropathing.pathgen.BezierLine;
import com.pedropathing.pathgen.PathChain;
import com.pedropathing.pathgen.Point;
import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;

class Intake {
    public enum State { IDLE, RUNNING, REVERSED }
    private DcMotor motor;
    private State state = State.IDLE;
    public Intake(HardwareMap hardwareMap) { motor = hardwareMap.get(DcMotor.class, "intake"); }
    public void run() { state = State.RUNNING; motor.setPower(1.0); }
    public void stop() { state = State.IDLE; motor.setPower(0); }
    public State getState() { return state; }
}

class Scorer {
    public enum State { STOWED, SCORING }
    private Servo servo;
    private State state = State.STOWED;
    public Scorer(HardwareMap hardwareMap) { servo = hardwareMap.get(Servo.class, "scorer"); }
    public void score() { state = State.SCORING; servo.setPosition(1.0); }
    public void stow() { state = State.STOWED; servo.setPosition(0.0); }
}

class Sensors {
    private ColorSensor color;
    private DistanceSensor distance;
    public Sensors(HardwareMap hardwareMap) {
        color = hardwareMap.get(ColorSensor.class, "color");
        distance = hardwareMap.get(DistanceSensor.class, "distance");
    }
    // Average several readings — a single reading is never trusted
    public double filteredDistance() {
        double sum = 0;
        for (int i = 0; i < 5; i++) sum += distance.getDistance(DistanceUnit.CM);
        return sum / 5.0;
    }
    public boolean seesRed() { return color.red() > color.blue() + 40; }
}

class Robot {
    public Intake intake;
    public Scorer scorer;
    public Sensors sensors;
    public Robot(HardwareMap hardwareMap) {
        intake = new Intake(hardwareMap);
        scorer = new Scorer(hardwareMap);
        sensors = new Sensors(hardwareMap);
    }
}

@Autonomous(name = "CapstoneAuto")
public class CapstoneAuto extends LinearOpMode {
    enum AutoState { TO_SAMPLE, DECIDE, TO_SCORE, SCORE, TO_PARK, PARKED }
    private AutoState state = AutoState.TO_SAMPLE;
    private Follower follower;
    private Robot robot;
    private boolean isRed = true;                       // alliance chosen in init_loop with the gamepad
    private final ElapsedTime matchTimer = new ElapsedTime();
    private final ElapsedTime pathTimer = new ElapsedTime();
    private Pose start, sample, score, park;
    private PathChain toSample, toScore, toPark;

    // Mirror y across the field centre for the blue alliance
    private Pose mirror(Pose p) { return isRed ? p : new Pose(p.getX(), 144 - p.getY(), -p.getHeading()); }

    private void buildPaths() {
        start = mirror(new Pose(9, 60, 0));
        sample = mirror(new Pose(48, 36, Math.toRadians(-45)));
        score = mirror(new Pose(36, 72, Math.toRadians(0)));
        park = mirror(new Pose(60, 96, Math.toRadians(90)));
        toSample = follower.pathBuilder().addPath(new BezierLine(new Point(start), new Point(sample))).setLinearHeadingInterpolation(start.getHeading(), sample.getHeading()).build();
        toScore = follower.pathBuilder().addPath(new BezierLine(new Point(sample), new Point(score))).setLinearHeadingInterpolation(sample.getHeading(), score.getHeading()).build();
        toPark = follower.pathBuilder().addPath(new BezierLine(new Point(score), new Point(park))).setConstantHeadingInterpolation(park.getHeading()).build();
    }

    @Override
    public void runOpMode() {
        follower = new Follower(hardwareMap);
        robot = new Robot(hardwareMap);
        while (!isStarted() && !isStopRequested()) {
            if (gamepad1.x) isRed = false;
            if (gamepad1.b) isRed = true;
            telemetry.addData("Alliance", isRed ? "RED" : "BLUE");
            telemetry.update();
        }
        buildPaths();
        follower.setStartingPose(start);
        matchTimer.reset();
        follower.followPath(toSample);
        pathTimer.reset();

        while (opModeIsActive()) {
            double loopStart = getRuntime();
            follower.update();
            // Emergency park: if fewer than 3 seconds remain, abandon the routine and park
            if (matchTimer.seconds() > 27 && state != AutoState.PARKED && state != AutoState.TO_PARK) {
                follower.followPath(toPark); state = AutoState.TO_PARK; pathTimer.reset();
            }
            switch (state) {
                case TO_SAMPLE:
                    // Timeout fallback: a path that takes too long is abandoned
                    if (!follower.isBusy() || pathTimer.seconds() > 6) { state = AutoState.DECIDE; }
                    break;
                case DECIDE:
                    if (robot.sensors.seesRed() && robot.sensors.filteredDistance() < 15) { robot.intake.run(); }
                    follower.followPath(toScore); pathTimer.reset(); state = AutoState.TO_SCORE;
                    break;
                case TO_SCORE:
                    if (!follower.isBusy() || pathTimer.seconds() > 6) { robot.intake.stop(); state = AutoState.SCORE; pathTimer.reset(); }
                    break;
                case SCORE:
                    robot.scorer.score();
                    if (pathTimer.seconds() > 1.5) { robot.scorer.stow(); follower.followPath(toPark); pathTimer.reset(); state = AutoState.TO_PARK; }
                    break;
                case TO_PARK:
                    if (!follower.isBusy() || pathTimer.seconds() > 6) state = AutoState.PARKED;
                    break;
                case PARKED:
                    break;
            }
            telemetry.addData("State", state);
            telemetry.addData("Distance", robot.sensors.filteredDistance());
            telemetry.addData("Intake", robot.intake.getState());
            telemetry.addData("Pose", follower.getPose());
            telemetry.addData("Loop ms", (getRuntime() - loopStart) * 1000);
            telemetry.update();
        }
    }
}
