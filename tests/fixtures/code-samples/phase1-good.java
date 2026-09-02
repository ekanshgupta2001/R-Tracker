package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.Servo;

@TeleOp(name = "Phase1TeleOp")
public class Phase1TeleOp extends LinearOpMode {
    // Drive motors are declared here so every method can reach them
    private DcMotor leftDrive;
    private DcMotor rightDrive;
    // The claw servo opens on A and closes on B
    private Servo claw;

    @Override
    public void runOpMode() {
        // Names must match the robot configuration on the Driver Hub exactly
        leftDrive = hardwareMap.get(DcMotor.class, "left_drive");
        rightDrive = hardwareMap.get(DcMotor.class, "right_drive");
        claw = hardwareMap.get(Servo.class, "claw");

        // The right motor is mounted mirrored, so reverse it to drive forward together
        rightDrive.setDirection(DcMotor.Direction.REVERSE);

        waitForStart();

        while (opModeIsActive()) {
            // Pushing the stick forward reads negative, so invert Y to get forward = positive
            double drive = -gamepad1.left_stick_y;
            double turn = gamepad1.right_stick_x;
            leftDrive.setPower(drive + turn);
            rightDrive.setPower(drive - turn);

            // Buttons control the mechanism; bumper values map to servo positions
            if (gamepad1.a) {
                claw.setPosition(0.0);
            } else if (gamepad1.b) {
                claw.setPosition(1.0);
            }

            telemetry.addData("Drive", drive);
            telemetry.addData("Turn", turn);
            telemetry.addData("Claw", claw.getPosition());
            telemetry.update();
        }
    }
}
