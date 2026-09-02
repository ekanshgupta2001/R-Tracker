package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;

@TeleOp(name = "BadTeleOp")
public class BadTeleOp extends LinearOpMode {
    DcMotor motor;

    @Override
    public void runOpMode() {
        motor = hardwareMap.get(DcMotor.class, "motor");
        waitForStart();
        while (opModeIsActive()) {
            motor.setPower(gamepad1.left_stick_y);
            sleep(100);
        }
    }
}
