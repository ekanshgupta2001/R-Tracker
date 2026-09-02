package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;

@Autonomous(name = "MinimalAuto")
public class MinimalAuto extends LinearOpMode {
    DcMotor left, right;

    @Override
    public void runOpMode() {
        left = hardwareMap.get(DcMotor.class, "left_drive");
        right = hardwareMap.get(DcMotor.class, "right_drive");
        waitForStart();
        left.setPower(0.5); right.setPower(0.5); sleep(3000);
        left.setPower(0); right.setPower(0);
        telemetry.addData("parked", true);
        telemetry.update();
    }
}
