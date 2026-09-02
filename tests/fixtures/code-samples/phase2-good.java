package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;
import com.qualcomm.robotcore.hardware.Servo;

// The drivetrain owns its motors; nothing outside this class touches them
class Drivetrain {
    private DcMotor left;
    private DcMotor right;

    public Drivetrain(HardwareMap hardwareMap) {
        left = hardwareMap.get(DcMotor.class, "left_drive");
        right = hardwareMap.get(DcMotor.class, "right_drive");
        right.setDirection(DcMotor.Direction.REVERSE);
    }

    public void drive(double forward, double turn) {
        left.setPower(forward + turn);
        right.setPower(forward - turn);
    }

    public void stop() {
        left.setPower(0);
        right.setPower(0);
    }
}

// The claw uses an enum so callers never pass magic servo numbers
class Claw {
    public enum ClawState { OPEN, CLOSED }

    private Servo servo;
    private ClawState state = ClawState.OPEN;

    public Claw(HardwareMap hardwareMap) {
        servo = hardwareMap.get(Servo.class, "claw");
    }

    public void open() { state = ClawState.OPEN; servo.setPosition(0.0); }
    public void close() { state = ClawState.CLOSED; servo.setPosition(1.0); }
    public ClawState getState() { return state; }
}

// Robot builds every subsystem once so OpModes stay tiny
class Robot {
    public Drivetrain drivetrain;
    public Claw claw;

    public Robot(HardwareMap hardwareMap) {
        drivetrain = new Drivetrain(hardwareMap);
        claw = new Claw(hardwareMap);
    }
}

@TeleOp(name = "CleanTeleOp")
public class CleanTeleOp extends LinearOpMode {
    @Override
    public void runOpMode() {
        Robot robot = new Robot(hardwareMap);
        waitForStart();
        while (opModeIsActive()) {
            robot.drivetrain.drive(-gamepad1.left_stick_y, gamepad1.right_stick_x);
            if (gamepad1.a) robot.claw.open();
            if (gamepad1.b) robot.claw.close();
            telemetry.addData("Claw", robot.claw.getState());
            telemetry.update();
        }
        robot.drivetrain.stop();
    }
}
