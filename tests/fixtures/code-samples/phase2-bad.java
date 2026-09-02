package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.Servo;

@TeleOp(name = "MessyTeleOp")
public class MessyTeleOp extends LinearOpMode {
    DcMotor left, right;
    Servo claw;

    @Override
    public void runOpMode() {
        left = hardwareMap.get(DcMotor.class, "left_drive");
        right = hardwareMap.get(DcMotor.class, "right_drive");
        claw = hardwareMap.get(Servo.class, "claw");
        waitForStart();
        while (opModeIsActive()) {
            left.setPower(-gamepad1.left_stick_y + gamepad1.right_stick_x);
            right.setPower(-gamepad1.left_stick_y - gamepad1.right_stick_x);
            if (gamepad1.a) claw.setPosition(0.37);
            if (gamepad1.b) claw.setPosition(0.82);
            telemetry.update();
        }
    }
}
